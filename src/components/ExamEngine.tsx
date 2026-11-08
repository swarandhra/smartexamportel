import { useEffect, useRef, useState } from 'react';
import { addResult, updateResultDraft, saveLocalExamState, clearLocalExamState } from '../utils/db';
import type { Exam, Question, Result } from '../utils/db';
import { startSecuritySystem, stopSecuritySystem, requestFullscreen, getViolationLog, getCameraCaptures } from '../utils/security';
import { saveResultToGoogleSheet, formatDuration } from '../utils/helpers';
import { transpileJavaToJS, extractMethodName, runTestCase } from '../utils/javaTranspiler';

import { showModal, showConfirm, showToast } from '../utils/notifications';
import WarningOverlay from './WarningOverlay';
import { Clock, Menu, X, Flag, Eraser, ArrowLeft, ArrowRight, Send, Check, Play, Rocket, Globe, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Palette, SubmitModal, CodeEditor, SaveChip, ShortcutsPopover } from './exam/ExamParts';
import type { SaveStatus, PaletteFilter } from './exam/ExamParts';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../utils/theme';
import '../styles/exam.css';

interface ExamEngineProps {
  exam: Exam;
  student: { name: string; rollNumber: string };
  activeDraft: Result | null;
  onFinished: (result: Result, uploadSuccess: boolean) => void;
}

function cleanSql(sql: string): string {
  return sql
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;$/, '')
    .trim();
}

function evaluateSqlJoin1(ans: string): boolean {
  const cleaned = cleanSql(ans);
  const ref1 = cleanSql("SELECT s.student_name, c.course_name FROM Students s INNER JOIN Courses c ON s.course_id = c.course_id");
  const ref2 = cleanSql("SELECT student_name, course_name FROM Students INNER JOIN Courses ON Students.course_id = Courses.course_id");
  if (cleaned === ref1 || cleaned === ref2) return true;

  if (!cleaned.startsWith('select')) return false;
  if (!cleaned.includes('join')) return false;
  if (!cleaned.includes('on')) return false;
  
  if (!cleaned.includes('student_name') || !cleaned.includes('course_name')) return false;
  if (!cleaned.includes('students') || !cleaned.includes('courses')) return false;
  
  const onPart = cleaned.split('on')[1] || '';
  if (!onPart.includes('course_id')) return false;
  
  const parts = onPart.split('=');
  if (parts.length !== 2) return false;
  if (!parts[0].includes('course_id') || !parts[1].includes('course_id')) return false;
  
  return true;
}

function evaluateSqlJoin2(ans: string): boolean {
  const cleaned = cleanSql(ans);
  const ref1 = cleanSql("SELECT s.student_name, m.subject, m.marks FROM Students s INNER JOIN Marks m ON s.student_id = m.student_id");
  const ref2 = cleanSql("SELECT student_name, subject, marks FROM Students INNER JOIN Marks ON Students.student_id = Marks.student_id");
  if (cleaned === ref1 || cleaned === ref2) return true;

  if (!cleaned.startsWith('select')) return false;
  if (!cleaned.includes('join')) return false;
  if (!cleaned.includes('on')) return false;
  
  if (!cleaned.includes('student_name') || !cleaned.includes('subject') || !cleaned.includes('marks')) return false;
  if (!cleaned.includes('students') || !cleaned.includes('marks')) return false;
  
  const onPart = cleaned.split('on')[1] || '';
  if (!onPart.includes('student_id')) return false;
  
  const parts = onPart.split('=');
  if (parts.length !== 2) return false;
  if (!parts[0].includes('student_id') || !parts[1].includes('student_id')) return false;
  
  return true;
}

function evaluateHtmlCssCoding(htmlCode: string): { passed: boolean; marks: number } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlCode, 'text/html');
    
    let score = 0;
    
    // Check heading
    const heading = doc.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading && heading.textContent?.trim()) {
      score += 1.5;
    }
    
    // Check button
    const button = doc.querySelector('button, input[type="button"], input[type="submit"], .btn, .button');
    if (button) {
      score += 1.5;
    }
    
    // Check text content
    const bodyText = doc.body ? doc.body.textContent || '' : '';
    const bodyTextLower = bodyText.toLowerCase();
    
    const hasName = bodyTextLower.includes('name') || bodyTextLower.includes('rahul');
    if (hasName) {
      score += 1.5;
    }
    
    const hasCourse = bodyTextLower.includes('course') || bodyTextLower.includes('java') || bodyTextLower.includes('stack');
    if (hasCourse) {
      score += 1.5;
    }
    
    const hasEmail = bodyTextLower.includes('email') || bodyTextLower.includes('@');
    if (hasEmail) {
      score += 1.5;
    }
    
    // Check style and CSS content
    const styleTags = doc.querySelectorAll('style');
    let cssText = '';
    styleTags.forEach(s => {
      cssText += s.textContent || '';
    });
    
    const hasCss = cssText.trim().length > 0;
    if (hasCss) {
      score += 1.0;
      
      const hasLayoutProps = cssText.includes('padding') || cssText.includes('margin') || cssText.includes('border') || cssText.includes('width');
      if (hasLayoutProps) {
        score += 1.0;
      }
      
      const hasMedia = cssText.includes('@media');
      if (hasMedia) {
        score += 2.0;
      }
    }
    
    const passed = score >= 6.0;
    const finalMarks = Math.round(score);
    
    return { passed, marks: finalMarks };
  } catch (e) {
    return { passed: false, marks: 0 };
  }
}

export default function ExamEngine({ exam, student, activeDraft, onFinished }: ExamEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Create a persistent ID for this result log (resumes draft or creates a new one)
  const resultIdRef = useRef(activeDraft ? activeDraft.id : 'result_' + Date.now());
  const lastSavedRef = useRef<{ fingerprint: string; at: number }>({ fingerprint: '', at: 0 });

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
  const [showUnfocusPopup, setShowUnfocusPopup] = useState(false);

  // Centered violation count popup (shown on Tab Switch / Exit Fullscreen)
  const [showViolationBanner, setShowViolationBanner] = useState(false);
  const [violationBannerCount, setViolationBannerCount] = useState(0);
  const violationBannerTimerRef = useRef<any>(null);
  const MAX_VIOLATIONS = 8;

  // Sound & Face proctoring popup states removed

  // Active question instances
  const [questions, setQuestions] = useState<Question[]>([]);
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});

  // UI-only state (never sent to the API)
  const [theme, toggleTheme] = useTheme();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ s: 'idle' });
  const [navOpen, setNavOpen] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timerNotice, setTimerNotice] = useState('');
  const reviewKey = `ui-review-marks-${exam.id}`;
  const [marked, setMarked] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(sessionStorage.getItem(reviewKey) || '{}'); } catch { return {}; }
  });
  


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

    // Ensure every question has an ID to prevent answers overwriting 'undefined'
    const questionsWithIds = exam.questions.map((q, idx) => {
      return q.id ? q : { ...q, id: `q_${idx}` };
    });

    // ── Separate MCQ-type questions from coding/practical ones ─────────────
    const rawMcqList = questionsWithIds.filter(
      q => q.type !== 'coding' && !q.type.startsWith('practical')
    );
    const codingList = questionsWithIds.filter(
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
      const msg = 'Are you sure you want to close the exam? Your progress is saved in the database but violations will be logged.';
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
            if (v.type === 'Unfocused Window') {
              setShowUnfocusPopup(true);
              setTimeout(() => {
                setShowUnfocusPopup(false);
              }, 5000);
            }
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

      // Lighter on the database: skip the network save when nothing changed since the last successful one
      // (still sent at least once a minute). The local backup above always runs.
      const fingerprint = JSON.stringify(answers) + '|' + logs.length + '|' + snaps.length;
      if (fingerprint === lastSavedRef.current.fingerprint && Date.now() - lastSavedRef.current.at < 60000) return;

      setSaveStatus({ s: 'saving' });
      const ok = await updateResultDraft(resultIdRef.current, answers, logs, snaps);
      if (ok) lastSavedRef.current = { fingerprint, at: Date.now() };
      setSaveStatus({ s: ok ? 'saved' : 'offline', at: Date.now() });
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
      showToast('Rendering HTML...', 'info');
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(answers[activeQ.id] || activeQ.codeTemplate || '');
        doc.close();
      }
      updateResultDraft(
        resultIdRef.current,
        { ...answers, [activeQ.id]: answers[activeQ.id] || activeQ.codeTemplate || '' },
        getViolationLog(),
        getCameraCaptures()
      ).catch(err => console.error("Draft update failed:", err));
      
      showToast('HTML rendered successfully', 'success');
    }
  };

  const handleSubmitCode = (q: Question) => {
    showConfirm(
      'Submit Code?',
      'Are you sure you want to save and submit this code?',
      () => processCodeSubmission(q),
      undefined,
      'Submit',
      'Cancel'
    );
  };

  const processCodeSubmission = (q: Question) => {
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
    let passCount = 0;
    
    q.testCases.forEach(tc => {
      let codeToTranspile = userCode;
      let rawInput = tc.input.trim();
      if (!rawInput.startsWith('"') && !rawInput.startsWith("'")) {
        rawInput = `"${rawInput}"`;
      }
      codeToTranspile = userCode.replace(/String\s+s\s*=\s*(["'])(.*?)\1\s*;/g, `String s = ${rawInput};`);

      let transpiledJS = '';
      try {
        transpiledJS = transpileJavaToJS(codeToTranspile);
      } catch (e) {}

      if (transpiledJS) {
        const methodName = extractMethodName(transpiledJS);
        if (methodName) {
          const { actual, error } = runTestCase(transpiledJS, methodName, tc.input);
          if (!error) {
            const actualClean = actual.replace(/"/g, '').trim().replace(/\s+/g, '');
            const expectedClean = tc.expected.trim().replace(/\s+/g, '').replace(/"/g, '');
            if (actualClean === expectedClean) {
              passCount++;
            }
          }
        }
      }
    });

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
    
    showToast('Executing code...', 'info');

    setTimeout(() => {
      const userCode = answers[q.id] || q.codeTemplate || '';

      updateResultDraft(
        resultIdRef.current,
        { ...answers, [q.id]: userCode },
        getViolationLog(),
        getCameraCaptures()
      ).catch(err => console.error("Draft update failed:", err));

      const results = q.testCases!.map((tc) => {
        let codeToTranspile = userCode;
        let rawInput = tc.input.trim();
        if (!rawInput.startsWith('"') && !rawInput.startsWith("'")) {
          rawInput = `"${rawInput}"`;
        }
        codeToTranspile = userCode.replace(/String\s+s\s*=\s*(["'])(.*?)\1\s*;/g, `String s = ${rawInput};`);

        let transpiledJS = '';
        let transpileError = '';
        try {
          transpiledJS = transpileJavaToJS(codeToTranspile);
        } catch (e: any) {
          transpileError = e.message;
        }

        if (transpileError) {
          return { input: tc.input, expected: tc.expected, actual: 'Compilation Error: ' + transpileError, passed: false };
        }
        const methodName = extractMethodName(transpiledJS);
        if (!methodName) {
          return { input: tc.input, expected: tc.expected, actual: 'Error: Could not detect method name. Make sure your class has a public method.', passed: false };
        }
        const { actual, error } = runTestCase(transpiledJS, methodName, tc.input);
        if (error) {
          return { input: tc.input, expected: tc.expected, actual: 'Runtime Error: ' + error, passed: false };
        }
        let actualClean = actual.replace(/"/g, '').trim();
        const expectedClean = tc.expected.trim().replace(/"/g, '');
        const passed = actualClean.replace(/\s+/g, '') === expectedClean.replace(/\s+/g, '');
        return { input: tc.input, expected: tc.expected, actual: actualClean, passed };
      });

      setSandboxOutputs(prev => ({ ...prev, [q.id]: results }));
      showToast('Code execution completed', 'success');
    }, 50);
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
      } else if (q.type === 'sql-join') {
        const isQuery1 = q.id === 'q_sql1' || q.questionText.includes('Student and Course');
        const isCorrect = isQuery1 ? evaluateSqlJoin1(ans || '') : evaluateSqlJoin2(ans || '');
        if (isCorrect) {
          correctAnswers++;
          marksObtained += q.marks;
        } else {
          wrongAnswers++;
        }
      } else if (q.type === 'practical-html') {
        const userHtml = ans || q.codeTemplate || '';
        if (q.id === 'q_html_coding' || q.questionText.toLowerCase().includes('card') || q.questionText.toLowerCase().includes('profile')) {
          const evalResult = evaluateHtmlCssCoding(userHtml);
          if (evalResult.passed) {
            correctAnswers++;
            marksObtained += q.marks;
          } else {
            wrongAnswers++;
            marksObtained += evalResult.marks;
          }
        } else {
          if (userHtml.includes('<form') && userHtml.includes('<input') && userHtml.length > q.codeTemplate!.length + 20) {
            correctAnswers++;
            marksObtained += q.marks;
          } else {
            wrongAnswers++;
          }
        }
      } else if (q.type === 'coding' || q.type === 'practical-java') {
        const userCode = ans || q.codeTemplate || '';
        let passCount = 0;
        const totalCases = q.testCases?.length || 1;

        q.testCases?.forEach(tc => {
          let codeToTranspile = userCode;
          let rawInput = tc.input.trim();
          if (!rawInput.startsWith('"') && !rawInput.startsWith("'")) {
            rawInput = `"${rawInput}"`;
          }
          codeToTranspile = userCode.replace(/String\s+s\s*=\s*(["'])(.*?)\1\s*;/g, `String s = ${rawInput};`);

          let transpiledJS = '';
          try {
            transpiledJS = transpileJavaToJS(codeToTranspile);
          } catch (e) {}

          if (transpiledJS) {
            const methodName = extractMethodName(transpiledJS);
            if (methodName) {
              const { actual, error } = runTestCase(transpiledJS, methodName, tc.input);
              if (!error) {
                const actualClean = actual.replace(/"/g, '').trim().replace(/\s+/g, '');
                const expectedClean = tc.expected.trim().replace(/\s+/g, '').replace(/"/g, '');
                if (actualClean === expectedClean) {
                  passCount++;
                }
              }
            }
          }
        });

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
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);
    await submitQuiz();
  };

  const toggleMark = (qId: string) => {
    setMarked(prev => {
      const next = { ...prev, [qId]: !prev[qId] };
      try { sessionStorage.setItem(reviewKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // One-time, non-blocking time notices (UI only; timer logic is untouched)
  useEffect(() => {
    const notices: Record<number, string> = { 600: '10 minutes remaining', 300: '5 minutes remaining', 60: '1 minute remaining' };
    if (notices[secondsRemaining]) {
      setTimerNotice(notices[secondsRemaining]);
      showToast(notices[secondsRemaining], secondsRemaining === 60 ? 'error' : 'warning');
    }
  }, [secondsRemaining]);

  // Shortcuts: bubble phase on document, so the proctoring capture handlers always run first.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || showSubmitModal || showWarning) return;
    const t = e.target as HTMLElement | null;
    const isRadio = t instanceof HTMLInputElement && t.type === 'radio';
    if (t && !isRadio && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const q = questions[activeQuestionIdx];
    if (!q) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowright') { e.preventDefault(); handleNext(); return; }
    if (key === 'arrowleft') { e.preventDefault(); handlePrev(); return; }
    if (key === 'm') { toggleMark(q.id); return; }
    if (q.type === 'mcq' && q.options) {
      const idx = '1234'.includes(key) && key.length === 1 ? parseInt(key, 10) - 1 : 'abcd'.indexOf(key);
      if (key.length === 1 && idx >= 0 && idx < q.options.length) handleSelectOption(q.id, String(idx));
    } else if (q.type === 'tf') {
      if (key === '1') handleSelectOption(q.id, 'true');
      if (key === '2') handleSelectOption(q.id, 'false');
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (questions.length === 0) {
    return (
      <div className="ui-shell" style={{ display: 'grid', placeItems: 'center' }} role="status" aria-live="polite">
        <div className="loading-state">Configuring exam environment…</div>
      </div>
    );
  }

  // Calculate Progress
  const totalQs = questions.length;
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k].trim() !== '').length;
  const progressPercent = totalQs > 0 ? (answeredCount / totalQs) * 100 : 0;
  const markedCount = questions.filter(q => marked[q.id]).length;

  // Format Timer
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timerClass = secondsRemaining < 60 ? 'is-crit' : secondsRemaining < 300 ? 'is-warn' : '';

  const isCodeQ = activeQ.type === 'coding' || activeQ.type === 'practical-java' || activeQ.type === 'practical-html';
  const isLast = activeQuestionIdx >= questions.length - 1;
  const feedback = submissionFeedback[activeQ.id];
  const selectQuestion = (idx: number) => { setActiveQuestionIdx(idx); setNavOpen(false); };

  const feedbackBanner = feedback && (
    <div className={`xm-feedback ${feedback.passed ? 'is-pass' : 'is-fail'}`} role="status">{feedback.message}</div>
  );

  const splitter = (
    <div className="xm-ws__split" onMouseDown={handleSplitMouseDown} role="separator" aria-orientation="vertical" aria-label="Resize panels" />
  );

  return (
    <div className={`xm ui-shell ${isCodeQ ? 'xm--code' : ''}`}>
      {/* Top Header */}
      <header className="xm-top">
        <div className="xm-title">
          <h1>{exam.title}</h1>
          <span>{student.name} · <span className="ui-mono">{student.rollNumber}</span></span>
        </div>

        <div className="xm-prog">
          <div className="xm-prog__text"><span>{answeredCount} / {totalQs} answered</span><span className="ui-mono">{progressPercent.toFixed(0)}%</span></div>
          <div className="xm-prog__bar" role="progressbar" aria-valuemin={0} aria-valuemax={totalQs} aria-valuenow={answeredCount} aria-label="Questions answered">
            <div className="xm-prog__fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        <div className="xm-tools">
          <SaveChip status={saveStatus} now={Date.now()} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ShortcutsPopover />
          <button type="button" className="ui-btn ui-btn--secondary xm-navtoggle" onClick={() => setNavOpen(true)} aria-label="Open question palette">
            <Menu size={18} strokeWidth={1.75} /> Questions
          </button>
          <div className={`xm-timer ${timerClass}`} id="exam-timer-widget" role="timer" aria-label="Time remaining">
            <Clock size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}</span>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">{timerNotice}</div>
      </header>

      <div className="xm-main">
        {navOpen && <div className="xm-backdrop" onClick={() => setNavOpen(false)} />}
        {/* Question navigator: docked, drawer or bottom sheet depending on viewport */}
        <aside className={`xm-nav ${navOpen ? 'is-open' : ''}`} aria-label="Question palette">
          <div className="xm-nav__head">
            <h2>Question palette</h2>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon xm-nav__close" onClick={() => setNavOpen(false)} aria-label="Close palette"><X size={18} strokeWidth={1.75} /></button>
          </div>
          <Palette questions={questions} activeIdx={activeQuestionIdx} answers={answers} visited={visitedQuestions} marked={marked}
            filter={paletteFilter} onFilter={setPaletteFilter} onSelect={selectQuestion} />
        </aside>

        {/* Question Panel */}
        <main className="xm-body">
          <div className="xm-q" key={activeQ.id}>
            {!isCodeQ && (
              <>
                <div className="xm-q__meta">
                  <span className="ui-badge ui-badge--primary">Question {activeQuestionIdx + 1}</span>
                  <span className="ui-badge ui-badge--info">{activeQ.type.toUpperCase()}</span>
                  <span className="ui-badge ui-badge--success">{activeQ.marks} {activeQ.marks === 1 ? 'mark' : 'marks'}</span>
                </div>
                <div className="xm-q__text">{activeQ.questionText}</div>
              </>
            )}

            {/* MCQ TYPE */}
            {activeQ.type === 'mcq' && activeQ.options && (
              <div className="xm-opts" role="radiogroup" aria-label="Options">
                {activeQ.options.map((opt, idx) => (
                  <label key={idx} className={`xm-opt ${activeAnswer === String(idx) ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name={`opt_${activeQ.id}`}
                      value={idx}
                      checked={activeAnswer === String(idx)}
                      onChange={() => handleSelectOption(activeQ.id, String(idx))}
                    />
                    <span className="xm-opt__letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="xm-opt__text">{opt}</span>
                    <Check size={20} strokeWidth={2.25} className="xm-opt__check" aria-hidden="true" />
                  </label>
                ))}
              </div>
            )}

            {/* TRUE FALSE TYPE */}
            {activeQ.type === 'tf' && (
              <div className="xm-opts xm-tf" role="radiogroup" aria-label="True or false">
                {(['true', 'false'] as const).map((v, i) => (
                  <label key={v} className={`xm-opt ${activeAnswer === v ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name={`tf_${activeQ.id}`}
                      value={v}
                      checked={activeAnswer === v}
                      onChange={() => handleSelectOption(activeQ.id, v)}
                    />
                    <span className="xm-opt__letter">{i + 1}</span>
                    <span className="xm-opt__text">{v === 'true' ? 'True' : 'False'}</span>
                    <Check size={20} strokeWidth={2.25} className="xm-opt__check" aria-hidden="true" />
                  </label>
                ))}
              </div>
            )}

            {/* FILL IN THE BLANK TYPE */}
            {activeQ.type === 'fib' && (
              <input
                type="text"
                className="xm-field"
                placeholder="Type your answer here..."
                aria-label="Your answer"
                value={activeAnswer}
                onChange={(e) => handleSelectOption(activeQ.id, e.target.value)}
                autoComplete="off"
              />
            )}

            {/* SHORT ANSWER or SQL JOIN TYPE */}
            {(activeQ.type === 'sa' || activeQ.type === 'sql-join') && (
              <textarea
                className="xm-field"
                rows={6}
                aria-label="Your answer"
                placeholder={activeQ.type === 'sql-join' ? "Write your SQL query here using INNER JOIN..." : "Explain your answer in detail..."}
                value={activeAnswer}
                onChange={(e) => handleSelectOption(activeQ.id, e.target.value)}
                autoComplete="off"
                style={activeQ.type === 'sql-join' ? { fontFamily: 'var(--font-mono)', fontSize: 14 } : undefined}
              ></textarea>
            )}

            {!isCodeQ && activeAnswer.trim() !== '' && (
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm xm-clear" onClick={() => handleSelectOption(activeQ.id, '')}>
                <Eraser size={16} strokeWidth={1.75} /> Clear response
              </button>
            )}

            {/* PRACTICAL HTML TYPE (Split Screen Live Preview Codebox) */}
            {activeQ.type === 'practical-html' && (
              <div className="xm-ws">
                <div className="xm-ws__left" style={{ width: `${splitPercent}%` }}>
                  <div className="xm-html-q">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="ui-badge ui-badge--info">HTML TASK</span>
                      <span style={{ fontSize: 12, color: 'var(--ws-muted)' }}>{activeQ.marks} marks</span>
                    </div>
                    {activeQ.questionText}
                  </div>
                  <div className="xm-ws__bar">
                    <span className="xm-ws__lang">index.html</span>
                    <div className="xm-ws__btns">
                      <button className="ui-btn ui-btn--secondary" onClick={handleRunHtmlCode}><Play size={15} strokeWidth={1.75} /> Run code</button>
                      <button className="ui-btn ui-btn--ok" onClick={() => handleSubmitCode(activeQ)}><Rocket size={15} strokeWidth={1.75} /> Submit code</button>
                    </div>
                  </div>
                  {feedbackBanner}
                  <CodeEditor
                    name={activeQ.id}
                    value={activeAnswer || activeQ.codeTemplate || ''}
                    placeholder="<!-- Write your HTML template code here -->"
                    onChange={(v) => handleSelectOption(activeQ.id, v)}
                    onKeyDown={handleKeyDownTextarea}
                  />
                </div>
                {splitter}
                <div className="xm-preview">
                  <div className="xm-preview__bar"><Globe size={15} strokeWidth={1.75} /> Live preview</div>
                  <iframe ref={iframeRef} title="HTML form split preview"></iframe>
                </div>
              </div>
            )}

            {/* CODING & PRACTICAL JAVA TYPES */}
            {(activeQ.type === 'coding' || activeQ.type === 'practical-java') && (
              <div className="xm-ws">
                <div className="xm-ws__left xm-prob" style={{ width: `${splitPercent}%` }}>
                  <div className="xm-prob__head">
                    <h2>Problem description</h2>
                    <span className="ui-badge ui-badge--info">{activeQ.marks} marks</span>
                  </div>
                  <div className="xm-prob__text">{activeQ.questionText}</div>
                  {activeQ.testCases && activeQ.testCases.length > 0 && (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <h3>Sample test cases</h3>
                      {activeQ.testCases.map((tc, idx) => (
                        <div key={idx} className="xm-tc">
                          <div><span>Input arguments:</span> {tc.input}</div>
                          <div><span>Expected output:</span> {tc.expected}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {splitter}
                <div className="xm-ws__right">
                  <div className="xm-ws__bar">
                    <span className="xm-ws__lang">Java (JDK 21)</span>
                    <div className="xm-ws__btns">
                      <button className="ui-btn ui-btn--secondary" onClick={() => handleRunCode(activeQ)}><Play size={15} strokeWidth={1.75} /> Run code</button>
                      <button className="ui-btn ui-btn--ok" onClick={() => handleSubmitCode(activeQ)}><Rocket size={15} strokeWidth={1.75} /> Submit code</button>
                    </div>
                  </div>
                  {feedbackBanner}
                  <CodeEditor
                    name={activeQ.id}
                    value={activeAnswer || activeQ.codeTemplate || ''}
                    onChange={(v) => handleSelectOption(activeQ.id, v)}
                    onKeyDown={handleKeyDownTextarea}
                  />
                  <div className="xm-term" aria-label="Sandbox execution output">
                    <div className="xm-term__head">$ sandbox output</div>
                    <div className="xm-term__body">
                      {sandboxOutputs[activeQ.id] ? sandboxOutputs[activeQ.id].map((tc, idx) => (
                        <div key={idx} className={`xm-case ${tc.passed ? 'is-pass' : ''}`}>
                          <div>
                            <div><span style={{ color: 'var(--ws-muted)' }}>Test case {idx + 1}:</span> input <code>{tc.input}</code></div>
                            <div><span style={{ color: 'var(--ws-muted)' }}>Expected:</span> <code>{tc.expected}</code></div>
                            <div><span style={{ color: 'var(--ws-muted)' }}>Returned:</span> <code style={{ color: tc.passed ? 'var(--code-ok)' : 'var(--code-bad)' }}>{tc.actual}</code></div>
                          </div>
                          <span className={`ui-badge ${tc.passed ? 'ui-badge--success' : 'ui-badge--danger'}`}>{tc.passed ? 'PASSED' : 'FAILED'}</span>
                        </div>
                      )) : (
                        <div style={{ color: 'var(--ws-muted)' }}>Click “Run code” to execute your solution against the test cases.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Webcam widget */}
      <div className="xm-cam" id="sec-cam-widget">
        <video ref={videoRef} id="exam-camera-stream" autoPlay playsInline muted></video>
        <div className="xm-live">Live</div>
      </div>

      {/* Footer Controls */}
      <footer className="xm-foot">
        <button className="ui-btn ui-btn--secondary" onClick={handlePrev} disabled={activeQuestionIdx === 0}>
          <ArrowLeft size={18} strokeWidth={1.75} /> Previous
        </button>
        <div className="xm-foot__mid">
          <span className="xm-counter">Question {activeQuestionIdx + 1} of {questions.length}</span>
          <button type="button" className={`ui-btn ui-btn--secondary ui-btn--sm xm-mark ${marked[activeQ.id] ? 'is-on' : ''}`} aria-pressed={!!marked[activeQ.id]} onClick={() => toggleMark(activeQ.id)}>
            <Flag size={16} strokeWidth={1.75} /> {marked[activeQ.id] ? 'Marked for review' : 'Mark for review'}
          </button>
        </div>
        {!isLast && (
          <button className="ui-btn ui-btn--primary" onClick={handleNext}>
            Save &amp; next <ArrowRight size={18} strokeWidth={1.75} />
          </button>
        )}
        <button className="ui-btn ui-btn--danger-outline xm-submit" onClick={handleManualSubmit}>
          <Send size={18} strokeWidth={1.75} /> Submit exam
        </button>
      </footer>

      {showSubmitModal && (
        <SubmitModal answered={answeredCount} unanswered={totalQs - answeredCount} marked={markedCount} busy={submitting}
          onConfirm={confirmSubmit} onCancel={() => setShowSubmitModal(false)} />
      )}

      {/* Warning Alert Modal */}
      <WarningOverlay
        show={showWarning}
        title={warningTitle}
        message={warningMsg}
        count={warningNum}
        onResume={handleResumeFullscreen}
      />

      {/* Security violation notice (non-blocking, left) */}
      {showViolationBanner && (
        <div className="xm-alert" style={{ top: 150 }} role="alert">
          <ShieldAlert size={22} strokeWidth={1.75} aria-hidden="true" />
          <div>
            <b>Security violation ({violationBannerCount}/{MAX_VIOLATIONS})</b>
            <span>
              {violationBannerCount < MAX_VIOLATIONS
                ? `${MAX_VIOLATIONS - violationBannerCount} more violation${MAX_VIOLATIONS - violationBannerCount === 1 ? '' : 's'} will auto-submit.`
                : 'Auto-submitting now...'}
            </span>
          </div>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon" style={{ width: 36 }} onClick={() => setShowViolationBanner(false)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {/* Unfocus notice (non-blocking, left) */}
      {showUnfocusPopup && (
        <div className="xm-alert xm-alert--warn" style={{ top: 250 }} role="alert">
          <AlertTriangle size={22} strokeWidth={1.75} aria-hidden="true" />
          <div>
            <b>Window unfocused</b>
            <span>Please focus back on the exam window. Continued shifting may flag your test.</span>
          </div>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon" style={{ width: 36 }} onClick={() => setShowUnfocusPopup(false)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
