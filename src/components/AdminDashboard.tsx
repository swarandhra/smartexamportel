import { useState, useEffect } from 'react';
import { getExams, addExam, deleteExam, getResults, getSettings, saveSettings } from '../utils/db';
import type { Exam, Question, Result } from '../utils/db';
import { downloadResultsCSV } from '../utils/helpers';
import { showToast, showModal, showConfirm } from '../utils/notifications';
import TodoPage from '../TodoPage'; 

function parseCSVQuestions(csvText: string): Question[] {
  const lines = csvText.split('\n');
  const questions: Question[] = [];
  let startIdx = 0;
  if (lines[0] && (lines[0].toLowerCase().includes('type') || lines[0].toLowerCase().includes('question'))) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cells: string[] = [];
    let insideQuote = false;
    let currentCell = '';
    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());

    const type = (cells[0] || 'mcq').toLowerCase().trim() as any;
    const questionText = cells[1]?.replace(/^"|"$/g, '') || '';
    const marks = parseInt(cells[2]) || 1;
    const optionsRaw = cells[3]?.replace(/^"|"$/g, '') || '';
    const correctVal = cells[4]?.replace(/^"|"$/g, '') || '';
    const codeTemplate = cells[5]?.replace(/^"|"$/g, '') || '';
    const testCasesRaw = cells[6]?.replace(/^"|"$/g, '') || '';

    const q: Question = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      questionText,
      marks
    };

    if (type === 'mcq') {
      q.options = optionsRaw.split('|').map(o => o.trim());
      q.correctOptionIndex = parseInt(correctVal) || 0;
    } else if (type === 'tf') {
      q.correctAnswer = correctVal.toLowerCase().trim() === 'true' ? 'true' : 'false';
    } else if (type === 'fib' || type === 'sa') {
      q.correctAnswer = correctVal.trim();
    } else if (type === 'coding' || type === 'practical-java') {
      q.codingLanguage = 'javascript';
      q.codeTemplate = codeTemplate || 'public class Solution {\n  // your method\n}';
      q.testCases = testCasesRaw ? testCasesRaw.split('|').map(tcStr => {
        const parts = tcStr.split('=>');
        return {
          input: parts[0]?.trim() || '',
          expected: parts[1]?.trim() || ''
        };
      }).filter(tc => tc.input) : [{ input: '', expected: '' }];
    } else if (type === 'practical-html') {
      q.codeTemplate = codeTemplate || '<!DOCTYPE html>\n<html>\n<body>\n</body>\n</html>';
      q.correctAnswer = correctVal || 'form';
    }

    questions.push(q);
  }
  return questions;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'exams' | 'create' | 'results' | 'analytics' | 'settings'>('exams');
  
  // Local Database states
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [settings, setSettings] = useState(getSettings());
  const [loading, setLoading] = useState(true);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Exam Creator Form state
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(90);
  const [examPassingMarks, setExamPassingMarks] = useState(40);
  const [examResumeWindow, setExamResumeWindow] = useState(60); // default 1 hour
  const [examStart, setExamStart] = useState('');
  const [examEnd, setExamEnd] = useState('');
  const [shuffleQs, setShuffleQs] = useState(true);
  const [shuffleOpts, setShuffleOpts] = useState(true);
  const [showRes, setShowRes] = useState(true);
  
  // Creation Mode: 'manual' | 'json'
  const [creationMode, setCreationMode] = useState<'manual' | 'json'>('manual');
  const [jsonExamContent, setJsonExamContent] = useState('');

  // Question list in builder
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [selectedQType, setSelectedQType] = useState<'mcq' | 'tf' | 'fib' | 'sa' | 'coding' | 'practical-html' | 'practical-java'>('mcq');

  // Audit modal overlay state
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (file.name.endsWith('.json')) {
        setJsonExamContent(content);
        setCreationMode('json');
      } else if (file.name.endsWith('.csv')) {
        try {
          const questions = parseCSVQuestions(content);
          setCurrentQuestions(questions);
          setCreationMode('manual');
          showToast(`Successfully parsed and loaded ${questions.length} questions from CSV!`, 'success');
        } catch (err: any) {
          showToast('Failed to parse CSV: ' + err.message, 'error');
        }
      } else {
        showToast('Unsupported file format. Please upload a .csv or .json file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Sync state lists asynchronously from Supabase
  const syncData = async () => {
    setLoading(true);
    try {
      const fetchedExams = await getExams();
      const fetchedResults = await getResults();
      setExams(fetchedExams);
      setResults(fetchedResults);
      setSettings(getSettings());
    } catch (e) {
      console.error('Failed to sync admin data from Supabase:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncData();
    const now = new Date();
    setExamStart(now.toISOString().slice(0, 16));
    setExamEnd(new Date(now.getTime() + 86400000).toISOString().slice(0, 16));
  }, []);

  const handleDeleteExam = async (id: string) => {
    showConfirm(
      'Delete Exam?',
      'Are you sure you want to permanently delete this exam from Supabase? This action cannot be undone.',
      async () => {
        setLoading(true);
        const res = await deleteExam(id);
        if (res.success) {
          showToast('Exam deleted successfully.', 'success');
        } else {
          showToast('Failed to delete: ' + (res.error || 'Unknown network or database error'), 'error');
        }
        await syncData();
      },
      undefined,
      'Delete Permanently',
      'Cancel'
    );
  };

  // Add Question to Form
  const handleAddQuestion = () => {
    const template: Question = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: selectedQType,
      questionText: '',
      marks: selectedQType === 'coding' ? 15 : selectedQType.startsWith('practical') ? 10 : 1
    };

    if (selectedQType === 'mcq') {
      template.options = ['', '', '', ''];
      template.correctOptionIndex = 0;
    } else if (selectedQType === 'tf') {
      template.correctAnswer = 'true';
    } else if (selectedQType === 'coding' || selectedQType === 'practical-java') {
      template.codingLanguage = 'javascript';
      template.codeTemplate = selectedQType === 'coding' 
        ? 'function moveZeroes(arr) {\n  // In-place logic\n}' 
        : 'function calculateMarks(math, science, english) {\n  // Return total, average, status\n}';
      template.testCases = [{ input: '', expected: '' }];
    } else if (selectedQType === 'practical-html') {
      template.codeTemplate = '<!DOCTYPE html>\n<html>\n<body>\n  \n</body>\n</html>';
      template.correctAnswer = 'form';
    } else {
      template.correctAnswer = '';
    }

    setCurrentQuestions(prev => [...prev, template]);
  };

  const handleUpdateQuestionText = (idx: number, text: string) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[idx].questionText = text;
      return updated;
    });
  };

  const handleUpdateQuestionMarks = (idx: number, marks: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[idx].marks = marks;
      return updated;
    });
  };

  // Option Updates
  const handleUpdateMCQOption = (qIdx: number, optIdx: number, val: string) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      if (updated[qIdx].options) {
        updated[qIdx].options![optIdx] = val;
      }
      return updated;
    });
  };

  const handleAddMCQOption = (qIdx: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      if (updated[qIdx].options) {
        updated[qIdx].options!.push('');
      }
      return updated;
    });
  };

  const handleDeleteMCQOption = (qIdx: number, optIdx: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      if (updated[qIdx].options) {
        updated[qIdx].options!.splice(optIdx, 1);
        if (updated[qIdx].correctOptionIndex! >= updated[qIdx].options!.length) {
          updated[qIdx].correctOptionIndex = 0;
        }
      }
      return updated;
    });
  };

  const handleSelectMCQCorrect = (qIdx: number, optIdx: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[qIdx].correctOptionIndex = optIdx;
      return updated;
    });
  };

  // Coding Parameter handlers
  const handleUpdateCodingLang = (qIdx: number, lang: any) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[qIdx].codingLanguage = lang;
      return updated;
    });
  };

  const handleUpdateCodingTemplate = (qIdx: number, val: string) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[qIdx].codeTemplate = val;
      return updated;
    });
  };

  const handleAddTestCase = (qIdx: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      if (updated[qIdx].testCases) {
        updated[qIdx].testCases!.push({ input: '', expected: '' });
      }
      return updated;
    });
  };

  const handleUpdateTestCase = (qIdx: number, tcIdx: number, field: 'input' | 'expected', val: string) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      if (updated[qIdx].testCases) {
        updated[qIdx].testCases![tcIdx][field] = val;
      }
      return updated;
    });
  };

  const handleDeleteTestCase = (qIdx: number, tcIdx: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      if (updated[qIdx].testCases) {
        updated[qIdx].testCases!.splice(tcIdx, 1);
      }
      return updated;
    });
  };

  const handleSelectTFCorrect = (qIdx: number, val: string) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[qIdx].correctAnswer = val;
      return updated;
    });
  };

  const handleUpdateTextCorrect = (qIdx: number, val: string) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[qIdx].correctAnswer = val;
      return updated;
    });
  };

  const handleDeleteQuestion = (idx: number) => {
    setCurrentQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit Exam Creation Form
  const handleSaveExam = async () => {
    const title = examTitle.trim();
    if (!title) {
      showToast('Please enter an exam title.', 'warning');
      return;
    }

    if (currentQuestions.length === 0) {
      showToast('Please add at least one question.', 'warning');
      return;
    }

    // Validation loops
    for (let i = 0; i < currentQuestions.length; i++) {
      const q = currentQuestions[i];
      if (!q.questionText.trim()) {
        showToast(`Question ${i + 1} has no text description.`, 'warning');
        return;
      }
      if (q.type === 'mcq') {
        if (q.options!.some(opt => !opt.trim())) {
          showToast(`All options in MCQ Question ${i + 1} must be filled out.`, 'warning');
          return;
        }
      } else if (q.type === 'coding' || q.type === 'practical-java') {
        if (!q.testCases || q.testCases.length === 0) {
          showToast(`Coding Question ${i + 1} requires at least one test case.`, 'warning');
          return;
        }
        if (q.testCases.some(tc => !tc.input.trim() || !tc.expected.trim())) {
          showToast(`All test case inputs and expected outputs in Coding Question ${i + 1} must be filled.`, 'warning');
          return;
        }
      } else if (q.type === 'fib' || q.type === 'sa') {
        if (!q.correctAnswer!.trim()) {
          showToast(`Correct answer context for Question ${i + 1} is empty.`, 'warning');
          return;
        }
      }
    }

    // Validate passing marks against actual total marks from questions
    const computedTotalMarks = currentQuestions.reduce((sum, q) => sum + q.marks, 0);
    if (examPassingMarks > computedTotalMarks) {
      showToast(`Passing marks (${examPassingMarks}) exceeds total question marks (${computedTotalMarks}). Please add more questions or reduce passing marks.`, 'warning');
      return;
    }

    const exam: Exam = {
      id: 'exam_' + Date.now(),
      title,
      duration: examDuration,
      passingMarks: examPassingMarks,
      startDate: examStart,
      endDate: examEnd,
      shuffleQuestions: shuffleQs,
      shuffleOptions: shuffleOpts,
      showResultToStudent: showRes,
      resumeWindow: examResumeWindow,
      questions: currentQuestions
    };

    setLoading(true);
    const res = await addExam(exam);
    setLoading(false);

    if (res.success) {
      showToast('Exam created and scheduled in Supabase successfully!', 'success');
      setExamTitle('');
      setCurrentQuestions([]);
      await syncData();
      setActiveTab('exams');
    } else {
      showToast('Failed to save exam to database: ' + res.error, 'error');
    }
  };

  // JSON Import handler
  const handleJSONBulkImport = async () => {
    try {
      const parsed = JSON.parse(jsonExamContent.trim());
      
      // Handle case where user pastes a questions-only array instead of a full exam object
      if (Array.isArray(parsed)) {
        showModal(
          'Invalid JSON Format',
          'Your JSON contains only a questions array. Please wrap it in an exam object like:\n\n{\n  "title": "My Exam",\n  "duration": 90,\n  "passingMarks": 40,\n  "questions": [ ... your questions ... ]\n}',
          'error'
        );
        return;
      }

      if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions)) {
        showToast('Invalid JSON structure. Missing "title" or "questions" list.', 'error');
        return;
      }

      const mappedQuestions = parsed.questions.map((q: any, idx: number) => ({
        id: q.id || `q_json_${idx}_${Date.now()}`,
        type: q.type || 'mcq',
        questionText: q.questionText || 'Question text missing',
        marks: q.marks || 1,
        options: q.options || undefined,
        correctOptionIndex: q.correctOptionIndex !== undefined ? q.correctOptionIndex : undefined,
        correctAnswer: q.correctAnswer || undefined,
        codingLanguage: q.codingLanguage || undefined,
        codeTemplate: q.codeTemplate || undefined,
        testCases: q.testCases || undefined
      }));

      // Compute total marks dynamically from the questions
      const computedTotalMarks = mappedQuestions.reduce((sum: number, q: any) => sum + q.marks, 0);
      const passingMarks = parsed.passingMarks !== undefined ? parsed.passingMarks : Math.round(computedTotalMarks * 0.4);

      // Validate passing marks against total marks
      if (passingMarks > computedTotalMarks) {
        showToast(`Passing marks (${passingMarks}) exceeds total question marks (${computedTotalMarks}). Please reduce passing marks or add more questions.`, 'warning');
        return;
      }

      const exam: Exam = {
        id: parsed.id || 'exam_' + Date.now(),
        title: parsed.title,
        duration: parsed.duration || 90,
        passingMarks: passingMarks,
        startDate: parsed.startDate || new Date().toISOString().slice(0, 16),
        endDate: parsed.endDate || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
        shuffleQuestions: parsed.shuffleQuestions !== undefined ? parsed.shuffleQuestions : true,
        shuffleOptions: parsed.shuffleOptions !== undefined ? parsed.shuffleOptions : true,
        showResultToStudent: parsed.showResultToStudent !== undefined ? parsed.showResultToStudent : true,
        resumeWindow: parsed.resumeWindow !== undefined ? parsed.resumeWindow : 60,
        questions: mappedQuestions
      };

      setLoading(true);
      const res = await addExam(exam);
      setLoading(false);

      if (res.success) {
        showToast(`Exam "${exam.title}" imported! ${exam.questions.length} questions, Total: ${computedTotalMarks} marks, Pass: ${passingMarks} marks.`, 'success');
        setJsonExamContent('');
        await syncData();
        setActiveTab('exams');
      } else {
        showToast('Failed to save imported exam: ' + res.error, 'error');
      }
    } catch (err: any) {
      showModal(
        'JSON Parse Error',
        'Parsing failed. Make sure your JSON format is valid.\n\nError: ' + err.message,
        'error'
      );
    }
  };

  // System Settings submit
  const handleUpdateSettings = (scriptUrl: string, pass: string) => {
    if (!pass.trim()) {
      showToast('Password cannot be empty.', 'warning');
      return;
    }
    saveSettings({ googleAppsScriptUrl: scriptUrl, adminPassword: pass });
    showToast('Settings updated successfully!', 'success');
    syncData();
  };

  // CSV download trigger
  const handleExportCSV = () => {
    downloadResultsCSV(results);
  };

  // PDF Print trigger
  const handlePrintResult = () => {
    if (!selectedResult) return;
    document.body.classList.add('printing-active');
    window.print();
    document.body.classList.remove('printing-active');
  };

  // Filtered Results
  const filteredResults = results.filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.examName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // SVG Analytics definitions
  const totalSubmissions = results.filter(r => r.isSubmitted).length;
  const passCount = results.filter(r => r.isSubmitted && r.status === 'Pass').length;
  const failCount = totalSubmissions - passCount;
  const passRate = totalSubmissions > 0 ? (passCount / totalSubmissions) * 100 : 0;
  
  const totalPercentSum = results.filter(r => r.isSubmitted).reduce((acc, r) => acc + r.percentage, 0);
  const avgPercentage = totalSubmissions > 0 ? totalPercentSum / totalSubmissions : 0;
  const totalViolationsCount = results.reduce((acc, r) => acc + r.totalViolations, 0);

  let camCount = 0, micCount = 0, fsCount = 0, tabCount = 0;
  results.forEach(r => {
    camCount += r.cameraViolations || 0;
    micCount += r.microphoneViolations || 0;
    fsCount += r.fullscreenViolations || 0;
    tabCount += r.tabSwitchingCount || 0;
  });

  const pieRadius = 50;
  const pieCircum = 2 * Math.PI * pieRadius;
  const passStrokeDash = (passRate / 100) * pieCircum;
  const failStrokeDash = pieCircum - passStrokeDash;

  // Average per exam
  const examAverages: Record<string, { sum: number; count: number }> = {};
  results.filter(r => r.isSubmitted).forEach(r => {
    if (!examAverages[r.examName]) {
      examAverages[r.examName] = { sum: 0, count: 0 };
    }
    examAverages[r.examName].sum += r.percentage;
    examAverages[r.examName].count += 1;
  });

  const chartExams = Object.keys(examAverages).map(name => ({
    name: name,
    avg: examAverages[name].sum / examAverages[name].count
  }));

  if (loading && exams.length === 0) {
    return (
      <div className="admin-workspace" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="loading-state">Syncing secure database records from Supabase...</div>
      </div>
    );
  }

  // Find matching exam for score breakdown
  const matchingExam = selectedResult ? exams.find(e => e.id === selectedResult.examId) : null;
  
  let aptObtained = 0, aptTotal = 0;
  let techObtained = 0, techTotal = 0;
  let codingObtained = 0, codingTotal = 0;
  let pracObtained = 0, pracTotal = 0;

  if (selectedResult && matchingExam) {
    matchingExam.questions.forEach((q, idx) => {
      const ans = selectedResult.answers[q.id];
      let isCorrect = false;
      let partialMarks = 0;

      if (q.type === 'mcq') {
        if (ans !== undefined && parseInt(ans) === q.correctOptionIndex) {
          isCorrect = true;
        }
      } else if (q.type === 'tf') {
        if (ans !== undefined && ans === q.correctAnswer) {
          isCorrect = true;
        }
      } else if (q.type === 'fib') {
        if (ans !== undefined && ans.toLowerCase().trim() === q.correctAnswer!.toLowerCase().trim()) {
          isCorrect = true;
        }
      } else if (q.type === 'sa') {
        if (ans !== undefined && ans.trim().length > 15) {
          isCorrect = true;
        }
      } else if (q.type === 'practical-html') {
        const userHtml = ans || q.codeTemplate || '';
        if (userHtml.includes('<form') && userHtml.includes('<input') && userHtml.length > q.codeTemplate!.length + 20) {
          isCorrect = true;
        }
      } else if (q.type === 'coding' || q.type === 'practical-java') {
        let passCount = 0;
        const userCode = ans || q.codeTemplate || '';
        q.testCases?.forEach(tc => {
          try {
            const cleanCode = userCode + `\n; if (typeof moveZeroes !== "undefined") { let a = ${tc.input}; moveZeroes(a); return JSON.stringify(a); } else if (typeof findSecondLargest !== "undefined") { return String(findSecondLargest(${tc.input})); } else if (typeof calculateMarks !== "undefined") { return JSON.stringify(calculateMarks(${tc.input})); } else { return null; }`;
            const runner = new Function(cleanCode);
            const val = runner();
            if (String(val).trim().replace(/\s+/g, '') === tc.expected.trim().replace(/\s+/g, '')) {
              passCount++;
            }
          } catch (e) {}
        });
        const totalCases = q.testCases?.length || 1;
        if (passCount === totalCases) {
          isCorrect = true;
        } else if (passCount > 0) {
          partialMarks = Math.floor((passCount / totalCases) * q.marks);
        }
      }

      const score = isCorrect ? q.marks : partialMarks;

      if (q.type === 'coding' || q.type === 'practical-java') {
        codingObtained += score;
        codingTotal += q.marks;
      } else if (q.type === 'practical-html') {
        pracObtained += score;
        pracTotal += q.marks;
      } else if (q.type === 'mcq') {
        aptObtained += score;
        aptTotal += q.marks;
      } else {
        // tf, fib, sa — Theory / Short Answer
        techObtained += score;
        techTotal += q.marks;
      }
    });
  }

  return (
    <div className="admin-workspace">
      {/* Sidebar navigation */}
      <div className="admin-sidebar">
        <div className="sidebar-brand">
          <h2>Smart Exam Portal</h2>
          <span>Teacher Dashboard</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${activeTab === 'exams' ? 'active' : ''}`} onClick={() => setActiveTab('exams')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            Manage Exams
          </button>
          <button className={`nav-btn ${activeTab === 'create' ? 'active' : ''}`} onClick={() => { setCurrentQuestions([]); setActiveTab('create'); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Exam
          </button>
          <button className={`nav-btn ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Student Results
          </button>
          <button className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Portal Analytics
          </button>
          <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            System Settings
          </button>
        </nav>
        <button className="btn btn-secondary logout-btn" onClick={onLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Exit Admin
        </button>
      </div>

      <div className="admin-content" id="admin-workspace-pane">
        {/* =================== TAB 1: EXAMS LIST =================== */}
        {activeTab === 'exams' && (
          <div className="tab-pane animate-fade-in">
            <div className="pane-header">
              <div>
                <h2>Manage Scheduled Examinations</h2>
                <p>Create, update, and review exams available in Supabase.</p>
              </div>
              <button className="btn btn-primary" onClick={() => setActiveTab('create')}>+ Create New Exam</button>
            </div>

            <div className="exams-grid">
              {exams.length === 0 ? (
                <div className="empty-state card-full">
                  <p>No exams configured in Supabase yet. Click 'Create Exam' to get started.</p>
                </div>
              ) : (
                exams.map(exam => (
                  <div key={exam.id} className="admin-exam-card animate-slide-up">
                    <div className="card-body">
                      <h3>{exam.title}</h3>
                      <div className="exam-meta-details">
                        <div><strong>Duration:</strong> {exam.duration} Minutes</div>
                        <div><strong>Questions:</strong> {exam.questions.length}</div>
                        <div><strong>Total Marks:</strong> {exam.questions.reduce((s: number, q: any) => s + (q.marks || 0), 0)}</div>
                        <div><strong>Passing Marks:</strong> {exam.passingMarks}</div>
                        <div><strong>Resume Window:</strong> {exam.resumeWindow} mins</div>
                        <div><strong>Start:</strong> {new Date(exam.startDate).toLocaleString()}</div>
                        <div><strong>End:</strong> {new Date(exam.endDate).toLocaleString()}</div>
                      </div>
                      <div className="exam-status-pills">
                        <span className={`badge ${exam.shuffleQuestions ? 'badge-primary' : 'badge-secondary'}`}>Shuffle Qs</span>
                        <span className={`badge ${exam.shuffleOptions ? 'badge-primary' : 'badge-secondary'}`}>Shuffle Options</span>
                        <span className={`badge ${exam.showResultToStudent ? 'badge-success' : 'badge-warning'}`}>
                          {exam.showResultToStudent ? 'Results Public' : 'Results Hidden'}
                        </span>
                      </div>
                    </div>
                    <div className="card-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExam(exam.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =================== TAB 2: CREATE EXAM =================== */}
        {activeTab === 'create' && (
          <div className="tab-pane animate-fade-in">
            <div className="pane-header">
              <div>
                <h2>Create New Examination</h2>
                <p>Build custom exams manually or perform a JSON bulk import.</p>
              </div>
              
              {/* Creator Mode switches */}
              <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
                <button 
                  className="btn btn-sm" 
                  onClick={() => setCreationMode('manual')}
                  style={{ background: creationMode === 'manual' ? '#fff' : 'transparent', color: '#1e293b' }}
                >
                  Manual Builder
                </button>
                <button 
                  className="btn btn-sm" 
                  onClick={() => setCreationMode('json')}
                  style={{ background: creationMode === 'json' ? '#fff' : 'transparent', color: '#1e293b' }}
                >
                  JSON Bulk Import
                </button>
              </div>
            </div>

            {creationMode === 'json' ? (
              <div className="form-container animate-fade-in">
                <div className="dashboard-card">
                  <div className="card-header">
                    <h3>JSON / CSV Bulk Upload</h3>
                  </div>
                  <div className="card-body" style={{ padding: '24px' }}>
                    
                    {/* Drag and Drop Uploader */}
                    <div 
                      className={`drag-drop-zone ${dragOver ? 'drag-over' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]); }}
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '8px',
                        padding: '30px',
                        textAlign: 'center',
                        background: dragOver ? '#f1f5f9' : '#fff',
                        cursor: 'pointer',
                        marginBottom: '20px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input 
                        type="file" 
                        accept=".csv,.json" 
                        onChange={handleFileUpload} 
                        style={{ display: 'none' }}
                        id="bulk-file-input" 
                      />
                      <label htmlFor="bulk-file-input" style={{ cursor: 'pointer', display: 'block', fontWeight: '500' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--dark-blue)" strokeWidth="2" style={{ margin: '0 auto 8px', display: 'block' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                        {fileName ? `Loaded File: ${fileName}` : 'Drag & Drop CSV / JSON File or Click to Browse'}
                      </label>
                    </div>

                    <p className="field-tip" style={{ marginBottom: '16px' }}>
                      Alternatively, paste structured exam JSON definitions. You can import large exam sets (e.g. 50 MCQs and 4 coding rounds) instantly.
                    </p>
                    <textarea 
                      className="form-control" 
                      rows={12} 
                      placeholder={`{\n  "title": "Placement Coding & MCQ Round",\n  "duration": 90,\n  "passingMarks": 40,\n  "resumeWindow": 60,\n  "questions": [\n    {\n      "type": "mcq",\n      "questionText": "What is the complexity of binary search?",\n      "options": ["O(N)", "O(log N)", "O(N log N)", "O(1)"],\n      "correctOptionIndex": 1,\n      "marks": 1\n    },\n    {\n      "type": "coding",\n      "questionText": "Write a function sum(a,b)...",\n      "marks": 15,\n      "codingLanguage": "javascript",\n      "codeTemplate": "function sum(a,b) {\\n}",\n      "testCases": [\n        { "input": "1,2", "expected": "3" }\n      ]\n    }\n  ]\n}`}
                      value={jsonExamContent}
                      onChange={(e) => setJsonExamContent(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '13px' }}
                    ></textarea>
                    
                    <button className="btn btn-primary" onClick={handleJSONBulkImport} style={{ marginTop: '16px' }}>
                      Verify & Import Exam
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-container animate-fade-in">
                <div className="dashboard-card">
                  <div className="card-header"><h3>General Details</h3></div>
                  <div className="card-body form-grid">
                    <div className="form-group col-span-2">
                      <label htmlFor="exam-title-input">Exam Title *</label>
                      <input 
                        type="text" 
                        id="exam-title-input" 
                        className="form-control" 
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="e.g. Midterm Placement Assessment" 
                        required 
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="exam-duration-input">Duration (Minutes) *</label>
                      <input 
                        type="number" 
                        id="exam-duration-input" 
                        className="form-control" 
                        value={examDuration}
                        onChange={(e) => setExamDuration(parseInt(e.target.value) || 1)}
                        placeholder="90" 
                        min="1" 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="exam-passing-input">Passing Marks *</label>
                      <input 
                        type="number" 
                        id="exam-passing-input" 
                        className="form-control" 
                        value={examPassingMarks}
                        onChange={(e) => setExamPassingMarks(parseInt(e.target.value) || 0)}
                        placeholder="40" 
                        min="0" 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="exam-resume-input">Resumption Window (Minutes) *</label>
                      <input 
                        type="number" 
                        id="exam-resume-input" 
                        className="form-control" 
                        value={examResumeWindow}
                        onChange={(e) => setExamResumeWindow(parseInt(e.target.value) || 1)}
                        placeholder="60" 
                        min="1" 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="exam-start-input">Start Date & Time *</label>
                      <input 
                        type="datetime-local" 
                        id="exam-start-input" 
                        className="form-control" 
                        value={examStart}
                        onChange={(e) => setExamStart(e.target.value)}
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="exam-end-input">End Date & Time *</label>
                      <input 
                        type="datetime-local" 
                        id="exam-end-input" 
                        className="form-control" 
                        value={examEnd}
                        onChange={(e) => setExamEnd(e.target.value)}
                        required 
                      />
                    </div>

                    <div className="form-group col-span-2 checkbox-grid">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={shuffleQs} onChange={(e) => setShuffleQs(e.target.checked)} /> Shuffle Questions Order
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={shuffleOpts} onChange={(e) => setShuffleOpts(e.target.checked)} /> Shuffle Options
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={showRes} onChange={(e) => setShowRes(e.target.checked)} /> Show Results to Student Immediately
                      </label>
                    </div>
                  </div>
                </div>

                {/* Question Manual Builder */}
                <div className="dashboard-card" style={{ marginTop: '24px' }}>
                  <div className="card-header flex-header">
                    <h3>Add Questions Manually</h3>
                    <div className="builder-actions" style={{ display: 'flex', gap: '8px' }}>
                      <select 
                        className="form-control inline-select"
                        value={selectedQType}
                        onChange={(e: any) => setSelectedQType(e.target.value)}
                      >
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        <option value="coding">Coding Round Question</option>
                        <option value="practical-html">Practical Task (HTML Form)</option>
                        <option value="practical-java">Practical Task (Java Program)</option>
                        <option value="tf">True / False</option>
                        <option value="fib">Fill in the Blank</option>
                        <option value="sa">Short Answer</option>
                      </select>
                      <button className="btn btn-primary" onClick={handleAddQuestion}>+ Add Question</button>
                    </div>
                  </div>
                  
                  <div className="card-body">
                    <div className="question-builder-list">
                      {currentQuestions.length === 0 ? (
                        <div className="empty-state">
                          <p>No questions added yet. Choose a question type and click '+ Add Question'.</p>
                        </div>
                      ) : (
                        currentQuestions.map((q, qIdx) => (
                          <div key={q.id} className="builder-question-card animate-fade-in">
                            <div className="card-head">
                              <h4>Question {qIdx + 1} ({q.type.toUpperCase()})</h4>
                              <button className="btn-icon" onClick={() => handleDeleteQuestion(qIdx)}>&times;</button>
                            </div>
                            
                            <div className="card-body">
                              <div className="form-group">
                                <label>Question Text / Description *</label>
                                <textarea 
                                  className="form-control" 
                                  value={q.questionText} 
                                  onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                                  placeholder="Enter question description..." 
                                  required 
                                />
                              </div>
                              
                              <div className="form-group inline-marks">
                                <label>Question Marks *</label>
                                <input 
                                  type="number" 
                                  className="form-control" 
                                  value={q.marks} 
                                  onChange={(e) => handleUpdateQuestionMarks(qIdx, parseInt(e.target.value) || 1)}
                                  min="1" 
                                  style={{ width: '100px' }} 
                                  required 
                                />
                              </div>

                              {/* TYPE MCQ */}
                              {q.type === 'mcq' && q.options && (
                                <div className="mcq-options-builder">
                                  <label>Options (Check correct one) *</label>
                                  <div className="options-inputs-list">
                                    {q.options.map((opt, optIdx) => (
                                      <div key={optIdx} className="option-row">
                                        <input 
                                          type="radio" 
                                          name={`correct_${q.id}`} 
                                          value={optIdx} 
                                          checked={q.correctOptionIndex === optIdx}
                                          onChange={() => handleSelectMCQCorrect(qIdx, optIdx)}
                                        />
                                        <input 
                                          type="text" 
                                          className="form-control" 
                                          value={opt} 
                                          onChange={(e) => handleUpdateMCQOption(qIdx, optIdx, e.target.value)}
                                          placeholder="Option text..." 
                                          required 
                                        />
                                        <button className="btn-icon" onClick={() => handleDeleteMCQOption(qIdx, optIdx)}>&times;</button>
                                      </div>
                                    ))}
                                  </div>
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleAddMCQOption(qIdx)} style={{ marginTop: '8px' }}>
                                    + Add Option
                                  </button>
                                </div>
                              )}

                              {/* TYPE CODING & PRACTICAL JAVA QUESTIONS */}
                              {(q.type === 'coding' || q.type === 'practical-java') && (
                                <div className="coding-question-builder" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div className="form-group">
                                    <label>Execution Target Language *</label>
                                    <select 
                                      className="form-control" 
                                      value={q.codingLanguage || 'javascript'}
                                      onChange={(e) => handleUpdateCodingLang(qIdx, e.target.value)}
                                    >
                                      <option value="javascript">JavaScript (Executable Browser Sandbox)</option>
                                      <option value="python">Python (Syntax Mocking)</option>
                                      <option value="cpp">C++ (Syntax Mocking)</option>
                                      <option value="java">Java (Syntax Mocking)</option>
                                    </select>
                                  </div>

                                  <div className="form-group">
                                    <label>Starter Code Template *</label>
                                    <textarea 
                                      className="form-control" 
                                      rows={4}
                                      value={q.codeTemplate || ''}
                                      onChange={(e) => handleUpdateCodingTemplate(qIdx, e.target.value)}
                                      placeholder="e.g. function solution() {\n  \n}"
                                      style={{ fontFamily: 'monospace' }}
                                    ></textarea>
                                  </div>

                                  <div className="test-cases-section" style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                      <h5>Test Cases (Required for validation)</h5>
                                      <button className="btn btn-secondary btn-sm" onClick={() => handleAddTestCase(qIdx)}>+ Add Test Case</button>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {q.testCases?.map((tc, tcIdx) => (
                                        <div key={tcIdx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                          <div style={{ flex: 1 }}>
                                            <input 
                                              type="text" 
                                              className="form-control form-control-sm" 
                                              placeholder="Input arguments (e.g. 2, 3)" 
                                              value={tc.input}
                                              onChange={(e) => handleUpdateTestCase(qIdx, tcIdx, 'input', e.target.value)}
                                            />
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <input 
                                              type="text" 
                                              className="form-control form-control-sm" 
                                              placeholder="Expected Return (e.g. 5)" 
                                              value={tc.expected}
                                              onChange={(e) => handleUpdateTestCase(qIdx, tcIdx, 'expected', e.target.value)}
                                            />
                                          </div>
                                          <button className="btn-icon" onClick={() => handleDeleteTestCase(qIdx, tcIdx)}>&times;</button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* PRACTICAL HTML TYPE */}
                              {q.type === 'practical-html' && (
                                <div className="html-practical-builder" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div className="form-group">
                                    <label>Starter HTML/CSS Template *</label>
                                    <textarea 
                                      className="form-control" 
                                      rows={6}
                                      value={q.codeTemplate || ''}
                                      onChange={(e) => handleUpdateCodingTemplate(qIdx, e.target.value)}
                                      placeholder="Starter HTML layouts..."
                                      style={{ fontFamily: 'monospace' }}
                                    ></textarea>
                                  </div>
                                </div>
                              )}

                              {/* TYPE TRUE FALSE */}
                              {q.type === 'tf' && (
                                <div className="tf-options-builder">
                                  <label>Correct Answer *</label>
                                  <div className="radio-group-horizontal">
                                    <label>
                                      <input 
                                        type="radio" 
                                        name={`tf_correct_${q.id}`} 
                                        value="true" 
                                        checked={q.correctAnswer === 'true'} 
                                        onChange={() => handleSelectTFCorrect(qIdx, 'true')} 
                                      /> 
                                      True
                                    </label>
                                    <label>
                                      <input 
                                        type="radio" 
                                        name={`tf_correct_${q.id}`} 
                                        value="false" 
                                        checked={q.correctAnswer === 'false'} 
                                        onChange={() => handleSelectTFCorrect(qIdx, 'false')} 
                                      /> 
                                      False
                                    </label>
                                  </div>
                                </div>
                              )}

                              {/* TYPE FIB */}
                              {q.type === 'fib' && (
                                <div className="fib-builder">
                                  <label>Correct Phrase *</label>
                                  <input 
                                    type="text" 
                                    className="form-control" 
                                    value={q.correctAnswer || ''} 
                                    onChange={(e) => handleUpdateTextCorrect(qIdx, e.target.value)}
                                    placeholder="Exact answer expected..." 
                                    required 
                                  />
                                </div>
                              )}

                              {/* TYPE SHORT ANSWER */}
                              {q.type === 'sa' && (
                                <div className="sa-builder">
                                  <label>Correct Answer Guidelines / Key Phrases *</label>
                                  <textarea 
                                    className="form-control" 
                                    value={q.correctAnswer || ''} 
                                    onChange={(e) => handleUpdateTextCorrect(qIdx, e.target.value)}
                                    rows={3} 
                                    placeholder="Reference answer guidelines for grading..." 
                                    required
                                  ></textarea>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Total Marks Summary */}
                {currentQuestions.length > 0 && (() => {
                  const liveTotalMarks = currentQuestions.reduce((sum, q) => sum + q.marks, 0);
                  const isOverflow = examPassingMarks > liveTotalMarks;
                  return (
                    <div style={{
                      marginTop: '24px',
                      padding: '16px 20px',
                      borderRadius: '10px',
                      background: isOverflow ? '#fef2f2' : '#f0fdf4',
                      border: `1px solid ${isOverflow ? '#fecaca' : '#bbf7d0'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '14px', fontWeight: 600 }}>
                        <span>📝 Questions: <strong>{currentQuestions.length}</strong></span>
                        <span>📊 Total Marks: <strong>{liveTotalMarks}</strong></span>
                        <span>✅ Passing Marks: <strong>{examPassingMarks}</strong></span>
                      </div>
                      {isOverflow && (
                        <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600 }}>
                          ⚠️ Passing marks ({examPassingMarks}) exceeds total ({liveTotalMarks})!
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => setActiveTab('exams')}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveExam}>Save & Schedule Exam</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================== TAB 3: STUDENT RESULTS =================== */}
        {activeTab === 'results' && (
          <div className="tab-pane animate-fade-in">
            <div className="pane-header">
              <div>
                <h2>Data Results Summary (Supabase Sync)</h2>
                <p>Review logs, marks, cheating violations, and download sheets.</p>
              </div>
              <div className="results-toolbar">
                <input 
                  type="text" 
                  className="form-control filter-input" 
                  placeholder="Search student, roll, or exam..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={handleExportCSV}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  Download CSV
                </button>
              </div>
            </div>

            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Roll Number</th>
                    <th>Exam Name</th>
                    <th>Total Score</th>
                    <th>Percentage</th>
                    <th>Status</th>
                    <th>Violations</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center' }}>No student records found in Supabase.</td>
                    </tr>
                  ) : (
                    filteredResults.map(res => (
                      <tr key={res.id}>
                        <td><strong>{res.studentName}</strong></td>
                        <td>{res.rollNumber}</td>
                        <td>{res.examName}</td>
                        <td>{res.marksObtained} / {res.totalMarks}</td>
                        <td>{res.percentage.toFixed(1)}%</td>
                        <td><span className={`status-badge ${res.status === 'Pass' ? 'pass' : 'fail'}`}>{res.status}</span></td>
                        <td>
                          <span className={`badge ${res.totalViolations > 0 ? 'badge-danger' : 'badge-success'}`}>
                            {res.totalViolations} Violations
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedResult(res)}>
                            Integrity Report
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================== TAB 4: PORTAL ANALYTICS =================== */}
        {activeTab === 'analytics' && (
          <div className="tab-pane animate-fade-in">
            <div className="pane-header">
              <h2>System Performance & Analytics</h2>
              <p>A summary of exam statistics, pass rates, and security health.</p>
            </div>

            {totalSubmissions === 0 ? (
              <div className="empty-state card-full">
                <p>Analytics require student results. Once students submit exams, charts will generate here.</p>
              </div>
            ) : (
              <>
                <div className="analytics-stats-grid">
                  <div className="stat-card">
                    <span className="s-label">Total Submissions</span>
                    <span className="s-val">{totalSubmissions}</span>
                  </div>
                  <div className="stat-card">
                    <span className="s-label">Average Score</span>
                    <span className="s-val">{avgPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="stat-card">
                    <span className="s-label">Class Pass Rate</span>
                    <span className="s-val">{passRate.toFixed(1)}%</span>
                  </div>
                  <div className="stat-card">
                    <span className="s-label">Total Integrity Alerts</span>
                    <span className="s-val red-text">{totalViolationsCount}</span>
                  </div>
                </div>

                <div className="analytics-charts-grid" style={{ marginTop: '24px' }}>
                  {/* Pie Outcomes */}
                  <div className="dashboard-card">
                    <div className="card-header"><h3>Completion Outcomes (Pass vs Fail)</h3></div>
                    <div className="card-body flex-center flex-column" style={{ padding: '24px' }}>
                      <svg width="200" height="200" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="60" cy="60" r={pieRadius} fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                        <circle cx="60" cy="60" r={pieRadius} fill="transparent" stroke="#10b981" strokeWidth="12" 
                          strokeDasharray={`${passStrokeDash} ${pieCircum}`} />
                        <circle cx="60" cy="60" r={pieRadius} fill="transparent" stroke="#ef4444" strokeWidth="12" 
                          strokeDasharray={`${failStrokeDash} ${pieCircum}`} strokeDashoffset={`-${passStrokeDash}`} />
                      </svg>
                      <div className="chart-legend" style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '13px' }}>
                        <div><span className="legend-box pass"></span> Pass: {passCount} ({passRate.toFixed(0)}%)</div>
                        <div><span className="legend-box fail"></span> Fail: {failCount} ({(100 - passRate).toFixed(0)}%)</div>
                      </div>
                    </div>
                  </div>

                  {/* Bar Violations */}
                  <div className="dashboard-card">
                    <div className="card-header"><h3>Integrity Violation Breakdown</h3></div>
                    <div className="card-body">
                      <div className="analytics-bar-chart">
                        <div className="analytics-row">
                          <div className="row-label">Tab Switches ({tabCount})</div>
                          <div className="row-bar-track">
                            <div className="row-bar-fill red" style={{ width: `${totalViolationsCount > 0 ? (tabCount / totalViolationsCount) * 100 : 0}%` }}></div>
                          </div>
                        </div>
                        <div className="analytics-row">
                          <div className="row-label">Fullscreen Exit ({fsCount})</div>
                          <div className="row-bar-track">
                            <div className="row-bar-fill red" style={{ width: `${totalViolationsCount > 0 ? (fsCount / totalViolationsCount) * 100 : 0}%` }}></div>
                          </div>
                        </div>
                        <div className="analytics-row">
                          <div className="row-label">Mic Activity ({micCount})</div>
                          <div className="row-bar-track">
                            <div className="row-bar-fill red" style={{ width: `${totalViolationsCount > 0 ? (micCount / totalViolationsCount) * 100 : 0}%` }}></div>
                          </div>
                        </div>
                        <div className="analytics-row">
                          <div className="row-label">Cam Disabled ({camCount})</div>
                          <div className="row-bar-track">
                            <div className="row-bar-fill red" style={{ width: `${totalViolationsCount > 0 ? (camCount / totalViolationsCount) * 100 : 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dashboard-card" style={{ marginTop: '24px' }}>
                  <div className="card-header"><h3>Performance by Exam Title</h3></div>
                  <div className="card-body">
                    <div className="custom-bar-grid">
                      <div className="bar-chart-y-axis">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                      </div>
                      <div className="bar-chart-columns">
                        {chartExams.map(ce => (
                          <div key={ce.name} className="chart-col">
                            <div className="col-fill-box">
                              <div className="fill-bar" style={{ height: `${ce.avg}%` }} title={`${ce.avg.toFixed(1)}%`}></div>
                            </div>
                            <span className="col-title">{ce.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* =================== TAB 5: SYSTEM SETTINGS =================== */}
        {activeTab === 'settings' && (
          <div className="tab-pane animate-fade-in">
            <div className="pane-header">
              <h2>System Configuration</h2>
              <p>Manage Apps Script webhooks, credentials, and Supabase integration status.</p>
            </div>

            <div className="form-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
              <div className="dashboard-card">
                <div className="card-header"><h3>Configuration Details</h3></div>
                <div className="card-body" style={{ padding: '24px' }}>
                  <div className="form-group">
                    <label htmlFor="settings-script-url">Google Apps Script Web App URL</label>
                    <input 
                      type="url" 
                      id="settings-script-url" 
                      className="form-control" 
                      defaultValue={settings.googleAppsScriptUrl} 
                      placeholder="https://script.google.com/macros/s/..." 
                      ref={(el) => { if (el) (el as any)._scriptUrl = el.value; }}
                      onBlur={(e) => { (e.target as any)._scriptUrl = e.target.value; }}
                    />
                    <p className="field-tip">All student responses will automatically post to this endpoint when exams are completed.</p>
                  </div>

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label htmlFor="settings-admin-pass">Admin/Teacher Portal Password</label>
                    <input 
                      type="password" 
                      id="settings-admin-pass" 
                      className="form-control" 
                      defaultValue={settings.adminPassword} 
                      ref={(el) => { if (el) (el as any)._adminPass = el.value; }}
                      onBlur={(e) => { (e.target as any)._adminPass = e.target.value; }}
                      placeholder="Enter new admin password" 
                    />
                  </div>

                  <button 
                    className="btn btn-primary" 
                    onClick={(e) => {
                      const container = e.currentTarget.parentElement;
                      const urlInput = container?.querySelector('#settings-script-url') as HTMLInputElement;
                      const passInput = container?.querySelector('#settings-admin-pass') as HTMLInputElement;
                      if (urlInput && passInput) {
                        handleUpdateSettings(urlInput.value, passInput.value);
                      }
                    }} 
                    style={{ marginTop: '16px' }}
                  >
                    Update Configurations
                  </button>
                </div>

                <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)' }}>
                  <TodoPage />
                </div>
              </div>

              <div className="dashboard-card">
                <div className="card-header"><h3>Google Spreadsheet Deployment Guide</h3></div>
                <div className="card-body docs-body">
                  <p>To view submissions in your Google Sheet, configure the connection as follows:</p>
                  <ol>
                    <li>Create a new Google Sheet.</li>
                    <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
                    <li>Delete any existing code and copy-paste the template file contents from <code>google_script_template.js</code>.</li>
                    <li>Click <strong>Deploy &gt; New Deployment</strong>.</li>
                    <li>Set <em>Select type</em> to <strong>Web App</strong>.</li>
                    <li>Set <em>Execute as</em> to <strong>Me</strong>.</li>
                    <li>Set <em>Who has access</em> to <strong>Anyone</strong> (necessary for client-side API requests).</li>
                    <li>Click <strong>Deploy</strong>, authorize the permissions, and copy the generated <strong>Web App URL</strong>.</li>
                    <li>Paste the URL into the settings box and click "Update Configurations".</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Modal Overlay */}
      {selectedResult && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-card animate-scale-up">
            <div className="modal-header">
              <h3>Audit Report: {selectedResult.studentName} ({selectedResult.rollNumber})</h3>
              <button className="btn-icon close-modal-btn" onClick={() => setSelectedResult(null)}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="print-printable-area">
                <div className="print-only print-header-block">
                  <h2>Smart Exam Portal - Student Certificate & Audit Report</h2>
                  <p>Generated: {new Date().toLocaleString()}</p>
                  <hr/>
                </div>

                <div className="modal-info-summary">
                  <div className="summary-item"><strong>Exam Name:</strong> {selectedResult.examName}</div>
                  <div className="summary-item"><strong>Completion Date:</strong> {selectedResult.date}</div>
                  <div className="summary-item"><strong>Duration Ticked:</strong> {selectedResult.timeTaken}</div>
                  <div className="summary-item"><strong>Final Score:</strong> {selectedResult.marksObtained} / {selectedResult.totalMarks} ({selectedResult.percentage.toFixed(1)}%)</div>
                  <div className="summary-item"><strong>Status:</strong> {selectedResult.status}</div>
                  <div className="summary-item"><strong>Total Violations:</strong> {selectedResult.totalViolations}</div>
                </div>

                {/* Score Breakdown Panel */}
                {matchingExam && (
                  <div className="report-section" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '12px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>Detailed Sectional Grade Breakdown</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <strong>1. Aptitude & Verbal (MCQs):</strong> <span className="highlight" style={{ fontSize: '14px', fontWeight: 'bold' }}>{aptObtained} / {aptTotal}</span> marks
                      </div>
                      <div>
                        <strong>2. Technical Core (Java/HTML/DSA):</strong> <span className="highlight" style={{ fontSize: '14px', fontWeight: 'bold' }}>{techObtained} / {techTotal}</span> marks
                      </div>
                      <div>
                        <strong>3. Coding Round (Leetcode Problems):</strong> <span className="highlight" style={{ fontSize: '14px', fontWeight: 'bold' }}>{codingObtained} / {codingTotal}</span> marks
                      </div>
                      <div>
                        <strong>4. Practical Tasks (HTML Form/Calculator):</strong> <span className="highlight" style={{ fontSize: '14px', fontWeight: 'bold' }}>{pracObtained} / {pracTotal}</span> marks
                      </div>
                    </div>
                  </div>
                )}

                <div className="report-section">
                  <h4>Anti-Cheating Log</h4>
                  {selectedResult.violationLog.length === 0 ? (
                    <div className="clean-audit">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 
                      Perfect Integrity. No browser violations detected.
                    </div>
                  ) : (
                    <div className="violations-table-mini">
                      <div className="v-header">
                        <span>Time</span>
                        <span>Violation Type</span>
                        <span>Warning #</span>
                      </div>
                      <div className="v-body">
                        {selectedResult.violationLog.map((v, index) => (
                          <div key={index} className="v-row">
                            <span>{v.time}</span>
                            <span className="v-type">{v.type}</span>
                            <span>{v.warningNumber || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedResult.cameraCaptures && selectedResult.cameraCaptures.length > 0 && (
                  <div className="report-section">
                    <h4>Webcam Audits ({selectedResult.cameraCaptures.length})</h4>
                    <div className="scrolling-captures" style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                      {selectedResult.cameraCaptures.map((snap, idx) => (
                        <div key={idx} className="capture-card" style={{ flexShrink: 0 }}>
                          <img src={snap.image} alt={`Cap @ ${snap.timestamp}`} style={{ borderRadius: '6px' }} />
                          <span style={{ fontSize: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>{snap.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SHOWING STUDENT ANSWERS AND CODING CODE DIRECTLY IN THE INTEGRITY REPORT */}
                {selectedResult.answers && Object.keys(selectedResult.answers).length > 0 && (
                  <div className="report-section" style={{ marginTop: '24px' }}>
                    <h4>Submitted Answers Summary</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {Object.entries(selectedResult.answers).map(([qId, ans]) => (
                        <div key={qId} style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Question ID: {qId}</div>
                          {ans.startsWith('//') || ans.includes('function') || ans.includes('def ') || ans.includes('<html') ? (
                            <pre style={{ margin: 0, padding: '8px', background: '#0f172a', color: '#cbd5e1', borderRadius: '4px', fontSize: '11px', overflowX: 'auto' }}>{ans}</pre>
                          ) : (
                            <div style={{ fontSize: '13px', fontWeight: '500' }}>{ans}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handlePrintResult}>Print Report / Save PDF</button>
              <button className="btn btn-primary" onClick={() => setSelectedResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
