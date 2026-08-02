import { useEffect, useRef, useState } from 'react';
import { addResult, updateResultDraft, saveLocalExamState, clearLocalExamState } from '../utils/db';
import type { Exam, Question, Result } from '../utils/db';
import { startSecuritySystem, stopSecuritySystem, requestFullscreen, getViolationLog, getCameraCaptures } from '../utils/security';
import { saveResultToGoogleSheet, formatDuration } from '../utils/helpers';
import { transpileJavaToJS, extractMethodName, runTestCase } from '../utils/javaTranspiler';

import { showModal, showConfirm, showToast } from '../utils/notifications';
import WarningOverlay from './WarningOverlay';

interface ExamEngineProps {
  exam: Exam;
  student: { name: string; rollNumber: string };
  activeDraft: Result | null;
  onFinished: (result: Result, uploadSuccess: boolean) => void;
}

export default function ExamEngine({ exam, student, activeDraft, onFinished }: ExamEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Create a persistent ID for this result log (resumes draft or creates a new one)
  const resultIdRef = useRef(activeDraft ? activeDraft.id : 'result_' + Date.now());

  // Navigation & States
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(exam.duration * 60);
  const [totalSeconds] = useState(exam.duration * 60);
  
  // Security warning overlay state
  const [showWarning, setShowWarning] = useState(false);
  const [warningTitle, setWarningTitle] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [warningNum, setWarningNum] = useState(0);

  // Centered violation count popup (shown on Tab Switch / Exit Fullscreen)
  const [showViolationBanner, setShowViolationBanner] = useState(false);
  const [violationBannerCount, setViolationBannerCount] = useState(0);
  const violationBannerTimerRef = useRef<any>(null);
  const MAX_VIOLATIONS = 8;

  // Sound & Face proctoring popup states
  const [showSoundPopup, setShowSoundPopup] = useState(false);
  const [showFacePopup, setShowFacePopup] = useState(false);
  const [facePopupType, setFacePopupType] = useState('');
  const soundPopupTimerRef = useRef<any>(null);
  const faceWarningTimerRef = useRef<any>(null);

  // Active question instances
  const [questions, setQuestions] = useState<Question[]>([]);
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});
  
  // Fake timer for multiple faces warnings (every exam.duration / 10)
  useEffect(() => {
    if (!exam.duration || exam.duration <= 0) return;
    const intervalMs = (exam.duration * 60 * 1000) / 10;
    const intervalId = setInterval(() => {
      setFacePopupType('Multiple Faces Detected');
      setShowFacePopup(true);
      if (faceWarningTimerRef.current) clearTimeout(faceWarningTimerRef.current);
      faceWarningTimerRef.current = setTimeout(() => setShowFacePopup(false), 4000);
    }, intervalMs);
    
    return () => clearInterval(intervalId);
  }, [exam.duration]);

  // Track visited questions
  useEffect(() => {
    if (questions.length > 0 && activeQuestionIdx >= 0 && activeQuestionIdx < questions.length) {
      const qId = questions[activeQuestionIdx].id;
      setVisitedQuestions(prev => {
        if (prev[qId]) return prev;
        return { ...prev, [qId]: true };
      });
    }
  }, [activeQuestionIdx, questions]);
  
  // Coding Sandbox execution results
  const [sandboxOutputs, setSandboxOutputs] = useState<Record<string, Array<{ input: string; expected: string; actual: string; passed: boolean }>>>({});

  const [splitPercent, setSplitPercent] = useState(50);
  const [submissionFeedback, setSubmissionFeedback] = useState<Record<string, { passed: boolean; message: string }>>({});

  const activeQ = questions[activeQuestionIdx];
  const activeAnswer = activeQ ? (answers[activeQ.id] || '') : '';

  // 1. Structure questions and shuffles
  useEffect(() => {
    // ── Seeded pseudo-random number generator (Mulberry32) ─────────────────
    // Produces a deterministic but unique shuffle per student per exam.
    // Same student always sees the same order (consistent on refresh/resume).
    const seedStr = student.rollNumber + '_' + exam.id;
    let seedNum = 0;
    for (let k = 0; k < seedStr.length; k++) {
      seedNum = ((seedNum << 5) - seedNum) + seedStr.charCodeAt(k);
      seedNum |= 0; // Convert to 32-bit int
    }
    function seededRandom(): number {
      seedNum |= 0; seedNum = seedNum + 0x6D2B79F5 | 0;
      let t = Math.imul(seedNum ^ seedNum >>> 15, 1 | seedNum);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    function seededShuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // ── Separate MCQ-type questions from coding/practical ones ─────────────
    const rawMcqList = exam.questions.filter(
      q => q.type !== 'coding' && !q.type.startsWith('practical')
    );
    const codingList = exam.questions.filter(
      q => q.type === 'coding' || q.type.startsWith('practical')
    );

    // ── Always shuffle MCQ question ORDER per student ─────────────────────
    // (uses seeded random so resume gives same order)
    const shuffledMcqList = seededShuffle(rawMcqList);

    // ── Always shuffle MCQ OPTIONS per question ───────────────────────────
    // Must also update correctOptionIndex to track the moved correct answer.
    const mcqListWithShuffledOptions = shuffledMcqList.map(q => {
      if (q.type !== 'mcq' || !q.options || q.options.length === 0) return q;

      // Build array of {text, isCorrect}
      const originalCorrectIdx = q.correctOptionIndex ?? 0;
      const optObjs = q.options.map((text, idx) => ({
        text,
        isCorrect: idx === originalCorrectIdx
      }));

      // Shuffle the option objects
      const shuffledOptObjs = seededShuffle(optObjs);

      // Find the new index of the correct answer
      const newCorrectIdx = shuffledOptObjs.findIndex(o => o.isCorrect);

      return {
        ...q,
        options: shuffledOptObjs.map(o => o.text),
        correctOptionIndex: newCorrectIdx
      };
    });

    // ── Coding/practicals always come at the end, NEVER shuffled ─────────
    const orderedQs = [...mcqListWithShuffledOptions, ...codingList];
    setQuestions(orderedQs);


    // Initialize/Restore attempts
    if (activeDraft) {
      setAnswers(activeDraft.answers || {});
      // Calculate remaining duration since the draft started
      const start = new Date(activeDraft.date + ' ' + activeDraft.startTime).getTime();
      const now = new Date().getTime();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      const remaining = Math.max(10, (exam.duration * 60) - elapsedSeconds);
      setSecondsRemaining(remaining);
    } else {
      // Create initial Draft entry in Supabase to start registration timer
      const now = new Date();
      const initialResult: Result = {
        id: resultIdRef.current,
        examId: exam.id,
        examName: exam.title,
        studentName: student.name,
        rollNumber: student.rollNumber,
        date: now.toLocaleDateString(),
        startTime: now.toLocaleTimeString(),
        endTime: '',
        timeTaken: '0 sec',
        totalQuestions: exam.questions.length,
        correctAnswers: 0,
        wrongAnswers: exam.questions.length,
        marksObtained: 0,
        totalMarks: exam.questions.reduce((acc, q) => acc + q.marks, 0),
        percentage: 0,
        status: 'Draft',
        isSubmitted: false,
        cameraViolations: 0,
        microphoneViolations: 0,
        fullscreenViolations: 0,
        tabSwitchingCount: 0,
        totalViolations: 0,
        violationLog: [],
        cameraCaptures: [],
        answers: {}
      };
      addResult(initialResult);
    }
  }, [exam, student, activeDraft]);

  // 2. Start Security Audits & Back Button Lockouts
  useEffect(() => {
    let securityInit = false;
    
    window.history.pushState(null, '', window.location.href);
    const preventBack = () => {
      window.history.pushState(null, '', window.location.href);
      showToast('Navigation is disabled during the examination. Use the question navigator.', 'warning');
    };
    
    const preventClose = (e: BeforeUnloadEvent) => {
      const msg = 'Are you sure you want to close the exam? Your progress is saved in Supabase but violations will be logged.';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    };

    window.addEventListener('popstate', preventBack);
    window.addEventListener('beforeunload', preventClose);

    const initSecurity = async () => {
      if (videoRef.current && !securityInit) {
        securityInit = true;
        await startSecuritySystem({
          videoElement: videoRef.current,
          onViolation: (v) => {
            console.log('Integrity violation recorded:', v);
          },
          onWarning: (type, count) => {
            // Show centered violation count popup
            setViolationBannerCount(count);
            setShowViolationBanner(true);
            if (violationBannerTimerRef.current) clearTimeout(violationBannerTimerRef.current);
            violationBannerTimerRef.current = setTimeout(() => setShowViolationBanner(false), 5000);
            // Also show the detailed warning overlay
            setWarningTitle(`${type} Detected!`);
            setWarningMsg(getViolationTip(type));
            setWarningNum(count);
            setShowWarning(true);
          },
          onAutoSubmit: (reason) => {
            showModal(
              '⚠️ Exam Auto-Submitted',
              `Your exam has been automatically submitted due to security violations.\n\nReason: ${reason}`,
              'error'
            );
            handleAutoSubmit();
          },
          onSoundDetected: (_volume) => {
            setShowSoundPopup(true);
            if (soundPopupTimerRef.current) clearTimeout(soundPopupTimerRef.current);
            soundPopupTimerRef.current = setTimeout(() => setShowSoundPopup(false), 4000);
          },
          onFaceViolation: (type) => {
            setFacePopupType(type);
            setShowFacePopup(true);
            if (type === 'Multiple Faces Detected' || type === 'Phone Detected') {
              if (faceWarningTimerRef.current) clearTimeout(faceWarningTimerRef.current);
              faceWarningTimerRef.current = setTimeout(() => setShowFacePopup(false), 4000);
            }
          }
        });
      }
    };

    const t = setTimeout(initSecurity, 500);

    return () => {
      clearTimeout(t);
      stopSecuritySystem();
      window.removeEventListener('popstate', preventBack);
      window.removeEventListener('beforeunload', preventClose);
    };
  }, []);

  // 3. Timer Tick
  useEffect(() => {
    if (secondsRemaining <= 0) {
      showModal(
        '⏰ Time Expired',
        'Your exam time has run out. Your answers are being submitted automatically.',
        'warning'
      );
      handleAutoSubmit();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  // 4. Autosave answers & sync drafts to Supabase database every 10 seconds
  useEffect(() => {
    const saveStateAndSyncDraft = async () => {
      // 1. Save local backup
      saveLocalExamState(student.rollNumber, exam.id, {
        answers: answers,
        activeQuestionIndex: activeQuestionIdx,
        secondsRemaining: secondsRemaining
      });

      // 2. Sync to Supabase
      const logs = getViolationLog();
      const snaps = getCameraCaptures();
      await updateResultDraft(resultIdRef.current, answers, logs, snaps);
    };

    const interval = setInterval(saveStateAndSyncDraft, 10000);
    return () => clearInterval(interval);
  }, [answers, activeQuestionIdx, secondsRemaining]);

  // Live HTML form visual rendering engine
  useEffect(() => {
    if (activeQ && activeQ.type === 'practical-html' && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(answers[activeQ.id] || activeQ.codeTemplate || '');
        doc.close();
      }
    }
  }, [answers, activeQuestionIdx, questions]);

  const getViolationTip = (type: string) => {
    switch (type) {
      case 'Tab Switch':
        return 'Changing browser focus, switching tabs, or opening external applications is prohibited.';
      case 'Exit Fullscreen':
        return 'You must remain in Full Screen mode to write this exam.';
      case 'Unfocused Window':
        return 'Do not minimize or click outside the examination panel.';
      case 'Voice Detected':
        return 'Sustained speaking or room noise was registered.';
      default:
        return 'Any further non-compliance will trigger an automated submission.';
    }
  };

  const handleSelectOption = (qId: string, val: string) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: val
    }));
  };

  const handleResumeFullscreen = () => {
    setShowWarning(false);
    requestFullscreen();
  };

  const handleAutoSubmit = async () => {
    await submitQuiz();
  };

  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMouseMove = (moveEvent: MouseEvent) => {
      const percent = (moveEvent.clientX / window.innerWidth) * 100;
      if (percent > 25 && percent < 75) {
        setSplitPercent(percent);
      }
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleRunHtmlCode = () => {
    if (activeQ && activeQ.type === 'practical-html' && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(answers[activeQ.id] || activeQ.codeTemplate || '');
        doc.close();
      }
    }
  };

  const handleSubmitCode = (q: Question) => {
    if (q.type === 'practical-html') {
      const userHtml = answers[q.id] || q.codeTemplate || '';
      const passed = userHtml.includes('<form') && userHtml.includes('<input') && userHtml.length > (q.codeTemplate?.length || 0) + 15;
      
      setSubmissionFeedback(prev => ({
        ...prev,
        [q.id]: {
          passed,
          message: passed 
            ? `✓ HTML Code Submitted! Required elements found.` 
            : `✗ HTML Code Submitted. Missing <form> or <input> elements. Please check your implementation.`
        }
      }));
      
      updateResultDraft(
        resultIdRef.current,
        {
          ...answers,
          [q.id]: userHtml
        },
        getViolationLog(),
        getCameraCaptures()
      ).catch(err => console.error("Draft update failed:", err));
      return;
    }

    if ((q.type !== 'coding' && q.type !== 'practical-java') || !q.testCases) return;
    
    handleRunCode(q);
    
    const userCode = answers[q.id] || q.codeTemplate || '';
    let transpiledJS = '';
    try {
      transpiledJS = transpileJavaToJS(userCode);
    } catch (e) {}

    let passCount = 0;
    if (transpiledJS) {
      const methodName = extractMethodName(transpiledJS);
      if (methodName) {
        q.testCases.forEach(tc => {
          const { actual, error } = runTestCase(transpiledJS, methodName, tc.input);
          if (!error && actual.replace(/"/g, '').trim().replace(/\s+/g, '') === tc.expected.trim().replace(/\s+/g, '')) {
            passCount++;
          }
        });
      }
    }

    const totalCases = q.testCases.length;
    const passedAll = passCount === totalCases;
    
    setSubmissionFeedback(prev => ({
      ...prev,
      [q.id]: {
        passed: passedAll,
        message: passedAll 
          ? `✓ Code Submitted! Passed all ${passCount}/${totalCases} test cases.` 
          : `✗ Code Submitted. Passed ${passCount}/${totalCases} test cases. Adjust your logic and submit again.`
      }
    }));
    
    updateResultDraft(
      resultIdRef.current,
      { ...answers, [q.id]: userCode },
      getViolationLog(),
      getCameraCaptures()
    ).catch(err => console.error("Draft update failed:", err));
  };

  // 5. Run local test-case evaluation sandbox
  const handleRunCode = (q: Question) => {

    if ((q.type !== 'coding' && q.type !== 'practical-java') || !q.testCases) return;
    const userCode = answers[q.id] || q.codeTemplate || '';

    let transpiledJS = '';
    let transpileError = '';
    try {
      transpiledJS = transpileJavaToJS(userCode);
    } catch (e: any) {
      transpileError = e.message;
    }

    const methodName = extractMethodName(transpiledJS);

    const results = q.testCases.map((tc) => {
      if (transpileError) {
        return { input: tc.input, expected: tc.expected, actual: 'Compilation Error: ' + transpileError, passed: false };
      }
      if (!methodName) {
        return { input: tc.input, expected: tc.expected, actual: 'Error: Could not detect method name. Make sure your class has a public method.', passed: false };
      }
      const { actual, error } = runTestCase(transpiledJS, methodName, tc.input);
      if (error) {
        return { input: tc.input, expected: tc.expected, actual: 'Runtime Error: ' + error, passed: false };
      }
      // Parse both actual and expected for numeric comparison
      let actualClean = actual.replace(/"/g, '').trim();
      const passed = actualClean.replace(/\s+/g, '') === tc.expected.trim().replace(/\s+/g, '');
      return { input: tc.input, expected: tc.expected, actual: actualClean, passed };
    });

    setSandboxOutputs(prev => ({ ...prev, [q.id]: results }));
  };


  // Handles Tab key inside textarea
  const handleKeyDownTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      target.value = newVal;
      target.selectionStart = target.selectionEnd = start + 2;

      handleSelectOption(target.name, newVal);
    }
  };

  const submitQuiz = async () => {
    stopSecuritySystem();
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.log(e));
    }

    clearLocalExamState(student.rollNumber, exam.id);

    const logs = getViolationLog();
    const snaps = getCameraCaptures();

    // Grade answers
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let totalMarks = 0;
    let marksObtained = 0;

    questions.forEach(q => {
      totalMarks += q.marks;
      const ans = answers[q.id];

      if (q.type === 'mcq') {
        if (ans !== undefined && parseInt(ans) === q.correctOptionIndex) {
          correctAnswers++;
          marksObtained += q.marks;
        } else {
          wrongAnswers++;
        }
      } else if (q.type === 'tf') {
        if (ans !== undefined && ans === q.correctAnswer) {
          correctAnswers++;
          marksObtained += q.marks;
        } else {
          wrongAnswers++;
        }
      } else if (q.type === 'fib') {
        if (ans !== undefined && ans.toLowerCase().trim() === q.correctAnswer!.toLowerCase().trim()) {
          correctAnswers++;
          marksObtained += q.marks;
        } else {
          wrongAnswers++;
        }
      } else if (q.type === 'sa') {
        if (ans !== undefined && ans.trim().length > 15) {
          correctAnswers++;
          marksObtained += q.marks;
        } else {
          wrongAnswers++;
        }
      } else if (q.type === 'practical-html') {
        // Evaluate HTML form task code layout
        const userHtml = ans || q.codeTemplate || '';
        if (userHtml.includes('<form') && userHtml.includes('<input') && userHtml.length > q.codeTemplate!.length + 20) {
          correctAnswers++;
          marksObtained += q.marks;
        } else {
          wrongAnswers++;
        }
      } else if (q.type === 'coding' || q.type === 'practical-java') {
        const userCode = ans || q.codeTemplate || '';
        let passCount = 0;
        
        let transpiledJS = '';
        try {
          transpiledJS = transpileJavaToJS(userCode);
        } catch (e) {}

        if (transpiledJS) {
          const classMatch = transpiledJS.match(/class\s+(\w+)/);
          const className = classMatch ? classMatch[1] : 'Solution';

          let methodName = 'solution';
          if (q.id.includes('coding_1') || q.questionText.toLowerCase().includes('zeroes')) {
            methodName = 'moveZeroes';
          } else if (q.id.includes('coding_2') || q.questionText.toLowerCase().includes('largest')) {
            methodName = 'findSecondLargest';
          } else if (q.id.includes('practical_2') || q.questionText.toLowerCase().includes('calculator')) {
            methodName = 'calculateTotal';
            if (transpiledJS.includes('calculateMarks')) {
              methodName = 'calculateMarks';
            }
          } else {
            const methodMatch = transpiledJS.match(/(\w+)\s*\([^)]*\)\s*\{/);
            if (methodMatch) methodName = methodMatch[1];
          }

          const isStatic = transpiledJS.includes(`static ${methodName}`) || transpiledJS.includes(`static  ${methodName}`);
          
          q.testCases?.forEach(tc => {
            try {
              let execTrigger = '';
              if (isStatic) {
                execTrigger = `; return JSON.stringify(${className}.${methodName}(${tc.input}));`;
              } else {
                execTrigger = `; const _inst = new ${className}();
                const _res = _inst.${methodName}(${tc.input});
                return JSON.stringify(_res);`;
              }
              const cleanCode = transpiledJS + `\n${execTrigger}`;
              const runner = new Function(cleanCode);
              const val = runner();
              if (String(val).trim().replace(/\s+/g, '') === tc.expected.trim().replace(/\s+/g, '')) {
                passCount++;
              }
            } catch (e) {}
          });
        }

        const totalCases = q.testCases?.length || 1;
        if (passCount === totalCases) {
          correctAnswers++;
          marksObtained += q.marks;
        } else {
          wrongAnswers++;
          if (passCount > 0) {
            marksObtained += Math.floor((passCount / totalCases) * q.marks);
          }
        }
      }
    });

    const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
    const status = marksObtained >= exam.passingMarks ? 'Pass' : 'Fail';
    
    const timeTakenSecs = totalSeconds - secondsRemaining;
    const now = new Date();

    const result: Result = {
      id: resultIdRef.current,
      examId: exam.id,
      examName: exam.title,
      studentName: student.name,
      rollNumber: student.rollNumber,
      date: now.toLocaleDateString(),
      startTime: activeDraft ? activeDraft.startTime : new Date(now.getTime() - timeTakenSecs * 1000).toLocaleTimeString(),
      endTime: now.toLocaleTimeString(),
      timeTaken: formatDuration(timeTakenSecs),
      totalQuestions: questions.length,
      correctAnswers,
      wrongAnswers,
      marksObtained,
      totalMarks,
      percentage,
      status,
      isSubmitted: true, // finalized
      cameraViolations: logs.filter(l => l.type.includes('Camera')).length,
      microphoneViolations: logs.filter(l => l.type.includes('Voice')).length,
      fullscreenViolations: logs.filter(l => l.type.includes('Fullscreen')).length,
      tabSwitchingCount: logs.filter(l => l.type.includes('Tab') || l.type.includes('Unfocus')).length,
      totalViolations: logs.length,
      violationLog: logs,
      cameraCaptures: snaps,
      answers: answers
    };

    // Save final submission to Supabase
    const dbRes = await addResult(result);
    
    // Sync to Google Sheets webhook
    const upload = await saveResultToGoogleSheet(result);
    
    onFinished(result, dbRes.success || upload.success);
  };

  const handleNext = () => {
    if (activeQuestionIdx < questions.length - 1) {
      setActiveQuestionIdx(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (activeQuestionIdx > 0) {
      setActiveQuestionIdx(prev => prev - 1);
    }
  };

  const handleManualSubmit = () => {
    const unanswered = questions.length - Object.keys(answers).length;
    let msg = 'Are you sure you want to submit your exam? This action cannot be undone.';
    if (unanswered > 0) {
      msg += `\n\nYou have left ${unanswered} question(s) unanswered.`;
    }
    showConfirm(
      'Submit Exam?',
      msg,
      () => submitQuiz(),
      undefined,
      'Submit Now',
      'Continue Exam'
    );
  };

  if (questions.length === 0) {
    return <div className="loading-state">Configuring Exam Environment...</div>;
  }

  // Calculate Progress
  const totalQs = questions.length;
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k].trim() !== '').length;
  const progressPercent = totalQs > 0 ? (answeredCount / totalQs) * 100 : 0;

  // Format Timer
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const isTimerLow = secondsRemaining < 60;

  return (
    <div className="exam-layout">
      {/* Top Header */}
      <div className="exam-topbar">
        <div className="exam-title-section">
          <h3>{exam.title}</h3>
          <span className="student-meta">{student.name} ({student.rollNumber})</span>
        </div>
        
        <div className="exam-progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="progress-text">{progressPercent.toFixed(0)}% Complete</span>
        </div>

        <div className={`exam-timer-section ${isTimerLow ? 'timer-low' : ''}`} id="exam-timer-widget">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}</span>
        </div>
      </div>

      <div className="exam-main" style={{ gridTemplateColumns: (activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html') ? '1fr' : '240px 1fr' }}>
        {/* Webcam Widget */}
        <div className="security-cam-widget" id="sec-cam-widget">
          <video ref={videoRef} id="exam-camera-stream" autoPlay playsInline muted></video>
          <div className="widget-overlay">REC</div>
        </div>

        {/* Side Question Navigator */}
        {!(activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html') && (
          <div className="question-nav-panel">
          <h4>MCQ Questions</h4>
          <div className="nav-grid" style={{ marginBottom: '16px' }}>
            {questions.filter(q => q.type !== 'coding' && !q.type.startsWith('practical')).map((q, idx) => {
              const answered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
              const isVisited = visitedQuestions[q.id];
              const isCurrent = questions.indexOf(q) === activeQuestionIdx;
              
              let btnClass = 'nav-item';
              if (answered) {
                btnClass += ' answered';
              } else if (isVisited) {
                btnClass += ' visited';
              } else {
                btnClass += ' not-visited';
              }
              if (isCurrent) btnClass += ' active';

              return (
                <button 
                  key={q.id}
                  className={btnClass}
                  onClick={() => setActiveQuestionIdx(questions.indexOf(q))}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <h4>Coding & Practicals</h4>
          <div className="nav-grid">
            {questions.filter(q => q.type === 'coding' || q.type.startsWith('practical')).map((q, idx) => {
              const answered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
              const isVisited = visitedQuestions[q.id];
              const isCurrent = questions.indexOf(q) === activeQuestionIdx;
              
              let btnClass = 'nav-item';
              if (answered) {
                btnClass += ' answered';
              } else if (isVisited) {
                btnClass += ' visited';
              } else {
                btnClass += ' not-visited';
              }
              if (isCurrent) btnClass += ' active';

              let label = `P${idx + 1}`;
              if (q.type === 'coding') label = `C${idx + 1}`;

              return (
                <button 
                  key={q.id}
                  className={btnClass}
                  onClick={() => setActiveQuestionIdx(questions.indexOf(q))}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Question Panel */}
        <div className="question-body-panel" style={{ 
          padding: (activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html') ? '0' : '40px',
          height: 'calc(100vh - 146px)',
          overflow: (activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html') ? 'hidden' : 'auto'
        }}>
          <div className="question-container animate-fade-in" key={activeQ.id} style={{ 
            maxWidth: (activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html') ? '100%' : '700px',
            margin: (activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html') ? '0' : '0 auto',
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column' 
          }}>
            {!(activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html') && (
              <>
                <div className="question-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="badge badge-primary">{activeQ.type.toUpperCase()}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Marks: {activeQ.marks}</span>
                </div>
                <div className="question-text" style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', whiteSpace: 'pre-line' }}>{activeQ.questionText}</div>
              </>
            )}
            
            
            {/* MCQ TYPE */}
            {activeQ.type === 'mcq' && activeQ.options && (
              <div className="options-container">
                {activeQ.options.map((opt, idx) => (
                  <label key={idx} className={`option-card ${activeAnswer === String(idx) ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name={`opt_${activeQ.id}`} 
                      value={idx}
                      checked={activeAnswer === String(idx)}
                      onChange={() => handleSelectOption(activeQ.id, String(idx))}
                    />
                    <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="option-text">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {/* TRUE FALSE TYPE */}
            {activeQ.type === 'tf' && (
              <div className="options-container tf-container">
                <label className={`option-card ${activeAnswer === 'true' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name={`tf_${activeQ.id}`} 
                    value="true" 
                    checked={activeAnswer === 'true'}
                    onChange={() => handleSelectOption(activeQ.id, 'true')}
                  />
                  <span className="option-text">True</span>
                </label>
                <label className={`option-card ${activeAnswer === 'false' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name={`tf_${activeQ.id}`} 
                    value="false" 
                    checked={activeAnswer === 'false'}
                    onChange={() => handleSelectOption(activeQ.id, 'false')}
                  />
                  <span className="option-text">False</span>
                </label>
              </div>
            )}

            {/* FILL IN THE BLANK TYPE */}
            {activeQ.type === 'fib' && (
              <div className="text-answer-container">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Type your answer here..."
                  value={activeAnswer}
                  onChange={(e) => handleSelectOption(activeQ.id, e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            {/* SHORT ANSWER TYPE */}
            {activeQ.type === 'sa' && (
              <div className="text-answer-container">
                <textarea 
                  className="form-control text-area" 
                  rows={6}
                  placeholder="Explain your answer in detail..."
                  value={activeAnswer}
                  onChange={(e) => handleSelectOption(activeQ.id, e.target.value)}
                  autoComplete="off"
                ></textarea>
              </div>
            )}

            {/* PRACTICAL HTML TYPE (Split Screen Live Preview Codebox) */}
            {activeQ.type === 'practical-html' && (
              <div className="html-split-layout" style={{ 
                display: 'flex', 
                gap: '0', 
                height: 'calc(100vh - 146px)', 
                width: '100%',
                background: '#0f172a',
                borderTop: '1px solid #1e293b'
              }}>
                {/* Left Panel: HTML Question & Editor */}
                <div className="html-left-panel" style={{ 
                  width: `${splitPercent}%`, 
                  flexShrink: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  background: '#0f172a', 
                  borderRight: '1px solid #1e293b', 
                  height: '100%', 
                  boxSizing: 'border-box' 
                }}>
                  {/* Left Top: Question Statement */}
                  <div className="html-question-statement" style={{ 
                    padding: '20px', 
                    background: '#1e293b', 
                    borderBottom: '1px solid #334155',
                    color: '#f8fafc',
                    overflowY: 'auto',
                    maxHeight: '180px',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge badge-primary" style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>HTML TASK</span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Marks: {activeQ.marks}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {activeQ.questionText}
                    </div>
                  </div>

                  {/* Left Bottom: Code Editor Container */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* Tab Bar showing index.html */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: '#1e293b', 
                      padding: '0 20px', 
                      borderBottom: '1px solid #334155',
                      height: '46px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', gap: '2px', height: '100%' }}>
                        <div style={{ 
                          background: '#0f172a', 
                          color: '#38bdf8', 
                          padding: '0 16px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          borderRight: '1px solid #1e293b', 
                          borderTop: '2px solid #38bdf8',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          <span style={{ color: '#e06c75' }}>&lt;&gt;</span> index.html
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleRunHtmlCode} style={{ padding: '4px 12px', fontSize: '12px', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px' }}>
                          ▶ Run Code
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleSubmitCode(activeQ)} style={{ padding: '4px 12px', fontSize: '12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px' }}>
                          🚀 Submit Code
                        </button>
                      </div>
                    </div>

                    {/* Submission Feedback Overlay banner */}
                    {submissionFeedback[activeQ.id] && (
                      <div style={{
                        padding: '12px 20px',
                        fontSize: '13px',
                        fontWeight: '600',
                        background: submissionFeedback[activeQ.id].passed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: submissionFeedback[activeQ.id].passed ? '#4ade80' : '#f87171',
                        borderBottom: `1px solid ${submissionFeedback[activeQ.id].passed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}>
                        {submissionFeedback[activeQ.id].message}
                      </div>
                    )}

                    {/* Textarea Editor */}
                    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                      <textarea
                        name={activeQ.id}
                        value={activeAnswer || activeQ.codeTemplate || ''}
                        onChange={(e) => handleSelectOption(activeQ.id, e.target.value)}
                        onKeyDown={handleKeyDownTextarea}
                        placeholder="<!-- Write your HTML template code here -->"
                        style={{
                          width: '100%',
                          height: '100%',
                          padding: '20px',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          fontSize: '13.5px',
                          background: '#0f172a',
                          color: '#f8fafc',
                          border: 'none',
                          resize: 'none',
                          outline: 'none',
                          lineHeight: '1.6',
                          boxSizing: 'border-box'
                        }}
                      ></textarea>
                    </div>
                  </div>
                </div>

                {/* Visual Draggable Splitter Handle */}
                <div 
                  className="html-splitter-bar"
                  onMouseDown={handleSplitMouseDown}
                  style={{
                    width: '6px',
                    cursor: 'col-resize',
                    background: '#1e293b',
                    alignSelf: 'stretch',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                    position: 'relative',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#38bdf8'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                >
                  <div style={{ width: '2px', height: '40px', background: '#334155', borderRadius: '1px' }}></div>
                </div>

                {/* Right Panel: Output Preview */}
                <div className="html-right-panel" style={{ 
                  flex: 1, 
                  minWidth: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  background: '#ffffff', 
                  height: '100%', 
                  boxSizing: 'border-box' 
                }}>
                  {/* Tab Bar showing Output Preview */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    background: '#f1f5f9', 
                    padding: '0 20px', 
                    borderBottom: '1px solid #cbd5e1',
                    height: '46px',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ 
                      background: '#ffffff', 
                      color: '#1e293b', 
                      padding: '0 16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      height: '100%',
                      borderRight: '1px solid #cbd5e1', 
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#64748b' }}>
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                      Live Preview Output
                    </div>
                  </div>

                  {/* Iframe View */}
                  <div style={{ flex: 1, minHeight: 0, background: '#ffffff' }}>
                    <iframe
                      ref={iframeRef}
                      title="HTML form split preview"
                      style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff' }}
                    ></iframe>
                  </div>
                </div>
              </div>
            )}

            {/* CODING & PRACTICAL JAVA TYPES - LeetCode Split Layout */}
            {(activeQ.type === 'coding' || activeQ.type === 'practical-java') && (
              <div className="leetcode-split-layout" style={{ 
                display: 'flex', 
                gap: '0', 
                height: 'calc(100vh - 146px)', 
                width: '100%',
                background: '#0f172a',
                borderTop: '1px solid #1e293b'
              }}>
                {/* Left Panel: Description and Test Cases */}
                <div className="leetcode-left-panel" style={{ 
                  width: `${splitPercent}%`, 
                  flexShrink: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px', 
                  background: '#0f172a', 
                  color: '#cbd5e1', 
                  padding: '24px', 
                  borderRight: '1px solid #1e293b', 
                  overflowY: 'auto', 
                  height: '100%', 
                  boxSizing: 'border-box' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>Problem Description</h4>
                    <span className="badge badge-secondary" style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '4px 10px', borderRadius: '12px', fontSize: '11px' }}>
                      {activeQ.marks} Marks
                    </span>
                  </div>
                  
                  <div className="problem-statement-text" style={{ fontSize: '14.5px', lineHeight: '1.7', color: '#e2e8f0', whiteSpace: 'pre-wrap', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {activeQ.questionText}
                  </div>

                  {/* Public Sample Test Cases */}
                  {activeQ.testCases && activeQ.testCases.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <h5 style={{ borderBottom: '1px solid #1e293b', paddingBottom: '8px', marginBottom: '16px', fontSize: '13.5px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sample Test Cases</h5>
                      {activeQ.testCases.slice(0, 2).map((tc, idx) => (
                        <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontFamily: 'Consolas, Monaco, monospace', marginBottom: '12px', color: '#e2e8f0' }}>
                          <div style={{ marginBottom: '4px' }}><strong style={{ color: '#64748b' }}>Input arguments:</strong> {tc.input}</div>
                          <div><strong style={{ color: '#64748b' }}>Expected output:</strong> {tc.expected}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Visual Draggable Splitter Handle */}
                <div 
                  className="leetcode-splitter-bar"
                  onMouseDown={handleSplitMouseDown}
                  style={{
                    width: '6px',
                    cursor: 'col-resize',
                    background: '#1e293b',
                    alignSelf: 'stretch',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                    position: 'relative',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#38bdf8'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                >
                  <div style={{ width: '2px', height: '40px', background: '#334155', borderRadius: '1px' }}></div>
                </div>

                {/* Right Panel: Code Editor and Console */}
                <div className="leetcode-right-panel" style={{ 
                  flex: 1, 
                  minWidth: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  background: '#0f172a', 
                  height: '100%', 
                  boxSizing: 'border-box' 
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    background: '#1e293b', 
                    padding: '10px 20px', 
                    borderBottom: '1px solid #334155',
                    height: '46px',
                    boxSizing: 'border-box'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="live-dot" style={{ display: 'inline-block', width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></span>
                      Language: Java (JDK 21)
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRunCode(activeQ)} style={{ padding: '4px 12px', fontSize: '12px', background: '#334155', color: '#f8fafc', border: 'none' }}>
                        ▶ Run Code
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleSubmitCode(activeQ)} style={{ padding: '4px 12px', fontSize: '12px', background: '#22c55e', color: '#fff', border: 'none' }}>
                        🚀 Submit Code
                      </button>
                    </div>
                  </div>

                  {/* Submission Feedback Overlay banner */}
                  {submissionFeedback[activeQ.id] && (
                    <div style={{
                      padding: '12px 20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: submissionFeedback[activeQ.id].passed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: submissionFeedback[activeQ.id].passed ? '#4ade80' : '#f87171',
                      borderBottom: `1px solid ${submissionFeedback[activeQ.id].passed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}>
                      {submissionFeedback[activeQ.id].message}
                    </div>
                  )}

                  <div className="editor-container" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                    <textarea
                      name={activeQ.id}
                      value={activeAnswer || activeQ.codeTemplate || ''}
                      onChange={(e) => handleSelectOption(activeQ.id, e.target.value)}
                      onKeyDown={handleKeyDownTextarea}
                      style={{
                        width: '100%',
                        height: '100%',
                        padding: '20px',
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        fontSize: '13.5px',
                        background: '#0f172a',
                        color: '#f8fafc',
                        border: 'none',
                        resize: 'none',
                        outline: 'none',
                        lineHeight: '1.6',
                        boxSizing: 'border-box'
                      }}
                    ></textarea>
                  </div>

                  {/* Sandbox Console Output */}
                  <div className="console-panel" style={{ 
                    background: '#0b0f19', 
                    color: '#38bdf8', 
                    padding: '20px', 
                    borderTop: '1px solid #1e293b', 
                    fontFamily: 'monospace', 
                    fontSize: '12.5px', 
                    overflowY: 'auto', 
                    maxHeight: '220px',
                    boxSizing: 'border-box'
                  }}>
                    <h5 style={{ color: '#94a3b8', marginTop: 0, marginBottom: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '6px', fontSize: '13px' }}>Sandbox Execution Output</h5>
                    {sandboxOutputs[activeQ.id] ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {sandboxOutputs[activeQ.id].map((tc, idx) => {
                          const isPublic = idx < 2;
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', border: '1px solid #1e293b', padding: '10px 14px', borderRadius: '6px', borderLeft: `3px solid ${tc.passed ? '#22c55e' : '#ef4444'}` }}>
                              {isPublic ? (
                                <div>
                                  <div><span style={{ color: '#64748b' }}>Test Case {idx + 1}:</span> Input: <code>{tc.input}</code></div>
                                  <div><span style={{ color: '#64748b' }}>Expected:</span> <code>{tc.expected}</code></div>
                                  <div><span style={{ color: '#64748b' }}>Returned:</span> <span style={{ color: tc.passed ? '#4ade80' : '#f87171' }}><code>{tc.actual}</code></span></div>
                                </div>
                              ) : (
                                <div>
                                  <div><strong>Test Case {idx + 1} (Locked 🔒)</strong></div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>Parameters and evaluation variables hidden for security guidelines.</div>
                                </div>
                              )}
                              <div>
                                <span style={{
                                  background: tc.passed ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                                  color: tc.passed ? '#4ade80' : '#f87171',
                                  border: `1px solid ${tc.passed ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                                  padding: '3px 10px',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  fontSize: '11px'
                                }}>
                                  {tc.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b' }}>Click "Run Code" to execute code parameters.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="exam-footer">
        <button className="btn btn-secondary" onClick={handlePrev} disabled={activeQuestionIdx === 0}>
          Previous
        </button>
        <div>
          <span className="question-counter">Question {activeQuestionIdx + 1} of {questions.length}</span>
        </div>
        
        {activeQuestionIdx < questions.length - 1 ? (
          <button className="btn btn-primary" onClick={handleNext}>
            Next
          </button>
        ) : (
          <button className="btn btn-danger" onClick={handleManualSubmit}>
            Submit Exam
          </button>
        )}
      </div>

      {/* Warning Alert Modal */}
      <WarningOverlay 
        show={showWarning}
        title={warningTitle}
        message={warningMsg}
        count={warningNum}
        onResume={handleResumeFullscreen}
      />

      {/* ── Centered Violation Count Banner ── */}
      {showViolationBanner && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000000,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          border: '2px solid #ef4444',
          borderRadius: '24px',
          padding: '36px 44px',
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(239,68,68,0.4), 0 25px 80px rgba(0,0,0,0.7)',
          animation: 'modal-scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          minWidth: '320px',
        }}>
          {/* Red glow backdrop */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '22px',
            background: 'radial-gradient(circle at center, rgba(239,68,68,0.12) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          {/* Warning icon */}
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 18px',
            background: 'rgba(239,68,68,0.15)',
            border: '2px solid rgba(239,68,68,0.5)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px'
          }}>⚠️</div>
          {/* Violation count */}
          <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '15px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Security Violation
          </div>
          <div style={{
            color: '#f8fafc', fontWeight: '800', fontSize: '42px', lineHeight: 1,
            marginBottom: '8px'
          }}>
            {violationBannerCount} <span style={{ color: '#64748b', fontSize: '28px' }}>/ {MAX_VIOLATIONS}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
            {violationBannerCount < MAX_VIOLATIONS
              ? `${MAX_VIOLATIONS - violationBannerCount} more violation${MAX_VIOLATIONS - violationBannerCount === 1 ? '' : 's'} will auto-submit your exam.`
              : 'Auto-submitting now...'}
          </div>
          {/* Progress bar */}
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '8px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{
              height: '100%',
              width: `${(violationBannerCount / MAX_VIOLATIONS) * 100}%`,
              background: violationBannerCount >= MAX_VIOLATIONS - 2
                ? 'linear-gradient(90deg, #ef4444, #b91c1c)'
                : 'linear-gradient(90deg, #f59e0b, #ef4444)',
              borderRadius: '999px',
              transition: 'width 0.4s ease'
            }} />
          </div>
          <button
            onClick={() => setShowViolationBanner(false)}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5', padding: '10px 28px', borderRadius: '12px',
              cursor: 'pointer', fontWeight: '600', fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.3)')}
            onMouseOut={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
          >
            I Understand
          </button>
        </div>
      )}

      {/* Sound Detected Popup - Non-violation, informational only */}

      {showSoundPopup && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 99999,
          background: 'rgba(30, 41, 59, 0.97)',
          border: '1px solid #f59e0b',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.25), 0 2px 8px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          animation: 'toast-slide-in 0.3s ease-out',
          maxWidth: '320px',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            width: '42px', height: '42px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid #f59e0b',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            animation: 'sound-pulse 1s infinite'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#fbbf24', marginBottom: '3px' }}>
              🔊 Sound Detected
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
              Noise detected in your environment. Silence is required during the exam.
            </div>
          </div>
          <button
            onClick={() => setShowSoundPopup(false)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
          >×</button>
        </div>
      )}

      {/* Face Violation Popup - Shows proctoring alert with dismiss */}
      {showFacePopup && (facePopupType === 'No Face Detected' || facePopupType === 'Excessive Face Movement') && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999999,
          background: '#0f172a',
          border: '2px solid #ef4444',
          borderRadius: '20px',
          padding: '32px 28px',
          maxWidth: '460px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 0 0 1px rgba(239,68,68,0.2), 0 25px 60px rgba(239,68,68,0.3)',
          animation: 'modal-scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#f8fafc'
        }}>
          {/* Backdrop */}
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            zIndex: -1,
            borderRadius: '20px'
          }} />
          <div style={{
            width: '60px', height: '60px',
            background: 'rgba(239,68,68,0.15)',
            border: '2px solid #ef4444',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              {facePopupType === 'No Face Detected' ? (
                <><circle cx="12" cy="8" r="5"/><path d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2"/><line x1="2" y1="2" x2="22" y2="22"/></>
              ) : (
                <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
              )}
            </svg>
          </div>
          <h3 style={{ margin: '0 0 10px', fontSize: '19px', fontWeight: '800', color: '#f87171' }}>
            🚨 {facePopupType}
          </h3>
          <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
            {facePopupType === 'No Face Detected' && 'Your face is not visible. Please ensure your face is fully visible within the camera frame.'}
            {facePopupType === 'Excessive Face Movement' && 'Unusual head movement detected. Please remain stationary and face the camera directly.'}
          </p>
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '22px', fontSize: '12.5px', color: '#f87171', fontWeight: '600' }}>
            ⚠️ This has been recorded as a violation. Repeated violations will auto-submit the exam.
          </div>
          <button
            onClick={() => setShowFacePopup(false)}
            style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#fff', border: 'none',
              padding: '12px 32px', borderRadius: '10px',
              fontWeight: '700', fontSize: '14px', cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(220,38,38,0.4)',
              transition: 'all 0.2s'
            }}
          >
            I Understand — Dismiss
          </button>
        </div>
      )}

      {/* Face Warning Popup - Top Right, like Sound */}
      {showFacePopup && (facePopupType === 'Multiple Faces Detected' || facePopupType === 'Phone Detected') && (
        <div style={{
          position: 'fixed',
          top: showSoundPopup ? '150px' : '80px',
          right: '24px',
          zIndex: 99999,
          background: 'rgba(30, 41, 59, 0.97)',
          border: '1px solid #f59e0b',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.25), 0 2px 8px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          animation: 'toast-slide-in 0.3s ease-out',
          maxWidth: '320px',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            width: '42px', height: '42px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid #f59e0b',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            animation: 'sound-pulse 1s infinite'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
              {facePopupType === 'Phone Detected' ? (
                <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>
              ) : (
                <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>
              )}
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#fbbf24', marginBottom: '3px' }}>
              ⚠️ {facePopupType}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
              {facePopupType === 'Phone Detected' ? 'A phone or device has been detected in the camera frame.' : 'More than one person is visible in the camera frame.'}
            </div>
          </div>
          <button
            onClick={() => setShowFacePopup(false)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
          >×</button>
        </div>
      )}

      {/* Add CSS animations for face popup and sound pulse */}
      <style>{`
        @keyframes sound-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
        }
        @keyframes modal-scale-in {
          from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes toast-slide-in {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
