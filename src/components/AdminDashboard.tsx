import { useState, useEffect } from 'react';
import { getExams, addExam, deleteExam, getResults, getSettings, saveSettings } from '../utils/db';
import type { Exam, Question, Result } from '../utils/db';
import { downloadResultsCSV } from '../utils/helpers';
import { showToast, showModal } from '../utils/notifications';
import { transpileJavaToJS, extractMethodName, runTestCase } from '../utils/javaTranspiler'; 
import {
  LayoutGrid, SquarePlus, ClipboardList, BarChart3, Settings, LogOut, PanelLeftClose, PanelLeftOpen, Moon, Sun, Plus, Download, Search, Trash2,
  EllipsisVertical, Clock, HelpCircle, Trophy, Target, RotateCcw, CalendarRange, ChevronDown, ChevronRight, GripVertical, X, Upload, CheckCircle2,
  XCircle, ListChecks, Code2, Globe, FileCode2, ToggleLeft, TextCursorInput, AlignLeft, Printer, ShieldCheck, Users, Percent, TrendingUp,
  AlertTriangle, FileQuestion, FileText, FileSearch, Save,
} from 'lucide-react';
import { useTheme } from '../utils/theme';
import '../styles/admin.css';

// UI-only: derive validation hints from the pasted/uploaded JSON (never used to gate the import itself)
function jsonChecks(content: string): { ok: boolean; label: string }[] {
  if (!content.trim()) return [];
  try {
    const parsed = JSON.parse(content.trim());
    if (Array.isArray(parsed)) return [{ ok: true, label: 'Valid JSON' }, { ok: false, label: 'Contains only a questions array. Wrap it in an exam object with a "title".' }];
    const out: { ok: boolean; label: string }[] = [{ ok: true, label: 'Valid JSON' }];
    out.push({ ok: !!parsed.title, label: parsed.title ? `Title: ${parsed.title}` : 'Missing "title"' });
    const qs = Array.isArray(parsed.questions) ? parsed.questions : null;
    out.push({ ok: !!qs && qs.length > 0, label: qs ? `${qs.length} question(s) found` : 'Missing "questions" list' });
    if (qs) {
      const total = qs.reduce((sum: number, q: any) => sum + (q.marks || 1), 0);
      const pass = parsed.passingMarks !== undefined ? parsed.passingMarks : Math.round(total * 0.4);
      out.push({ ok: pass <= total, label: `Total ${total} marks, passing ${pass}${pass > total ? ' (exceeds total)' : ''}` });
    }
    return out;
  } catch (err: any) {
    return [{ ok: false, label: 'Invalid JSON: ' + err.message }];
  }
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
    const heading = doc.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading && heading.textContent?.trim()) score += 1.5;
    
    const button = doc.querySelector('button, input[type="button"], input[type="submit"], .btn, .button');
    if (button) score += 1.5;
    
    const bodyText = doc.body ? doc.body.textContent || '' : '';
    const bodyTextLower = bodyText.toLowerCase();
    
    if (bodyTextLower.includes('name') || bodyTextLower.includes('rahul')) score += 1.5;
    if (bodyTextLower.includes('course') || bodyTextLower.includes('java') || bodyTextLower.includes('stack')) score += 1.5;
    if (bodyTextLower.includes('email') || bodyTextLower.includes('@')) score += 1.5;
    
    const styleTags = doc.querySelectorAll('style');
    let cssText = '';
    styleTags.forEach(s => { cssText += s.textContent || ''; });
    
    if (cssText.trim().length > 0) {
      score += 1.0;
      if (cssText.includes('padding') || cssText.includes('margin') || cssText.includes('border') || cssText.includes('width')) score += 1.0;
      if (cssText.includes('@media')) score += 2.0;
    }
    
    return { passed: score >= 6.0, marks: Math.round(score) };
  } catch (e) {
    return { passed: false, marks: 0 };
  }
}

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
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('All');

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

  // UI-only state
  const [theme, toggleTheme] = useTheme();
  const [collapsed, setCollapsed] = useState<boolean>(() => { try { return localStorage.getItem('ui-admin-sidebar') === '1'; } catch { return false; } });
  const toggleCollapsed = () => setCollapsed(c => { const n = !c; try { localStorage.setItem('ui-admin-sidebar', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  const [qCollapsed, setQCollapsed] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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
      console.error('Failed to sync admin data from database:', e);
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

  const handleDeleteExam = (id: string) => {
    setPendingDelete(id);
  };

  const confirmDeleteExam = async (id: string) => {
    setPendingDelete(null);
    setLoading(true);
    const res = await deleteExam(id);
    if (res.success) {
      showToast('Exam deleted successfully.', 'success');
    } else {
      showToast('Failed to delete: ' + (res.error || 'Unknown network or database error'), 'error');
    }
    await syncData();
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
      showToast('Exam created and scheduled successfully!', 'success');
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
    downloadResultsCSV(filteredResults);
  };

  // PDF Print trigger
  const handlePrintResult = () => {
    if (!selectedResult) return;
    document.body.classList.add('printing-active');
    window.print();
    document.body.classList.remove('printing-active');
  };

  // Filtered Results
  const filteredResults = results.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.examName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesExam = selectedExamFilter === 'All' || r.examName === selectedExamFilter;
    return matchesSearch && matchesExam;
  });

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
      <div className="ui-shell" data-theme={theme}>
        <div className="ui-container" aria-busy="true" aria-label="Syncing secure database records">
          <div className="ui-skeleton" style={{ height: 56, marginBottom: 24 }} />
          <div className="ui-skeleton" style={{ height: 160, marginBottom: 16 }} />
          <div className="ui-skeleton" style={{ height: 160 }} />
        </div>
      </div>
    );
  }

  const matchingExam = selectedResult ? exams.find(e => e.id === selectedResult.examId) : null;
  const isFinalExam = matchingExam?.id === 'final-exam';
  
  let aptObtained = 0, aptTotal = 0;
  let techObtained = 0, techTotal = 0;
  let codingObtained = 0, codingTotal = 0;
  let pracObtained = 0, pracTotal = 0;

  // Custom Final Exam categories
  let sqlObtained = 0, sqlTotal = 0;

  if (selectedResult && matchingExam) {
    matchingExam.questions.forEach(q => {
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
      } else if (q.type === 'sql-join') {
        const isQuery1 = q.id === 'q_sql1' || q.questionText.includes('Student and Course');
        isCorrect = isQuery1 ? evaluateSqlJoin1(ans || '') : evaluateSqlJoin2(ans || '');
      } else if (q.type === 'practical-html') {
        const userHtml = ans || q.codeTemplate || '';
        if (isFinalExam && (q.id === 'q_html_coding' || q.questionText.toLowerCase().includes('card') || q.questionText.toLowerCase().includes('profile'))) {
          const evalResult = evaluateHtmlCssCoding(userHtml);
          if (evalResult.passed) {
            isCorrect = true;
          } else {
            partialMarks = evalResult.marks;
          }
        } else {
          if (userHtml.includes('<form') && userHtml.includes('<input') && userHtml.length > q.codeTemplate!.length + 20) {
            isCorrect = true;
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
          isCorrect = true;
        } else if (passCount > 0) {
          partialMarks = Math.floor((passCount / totalCases) * q.marks);
        }
      }

      const score = isCorrect ? q.marks : partialMarks;

      if (isFinalExam) {
        if (q.id.startsWith('q_apt_')) {
          aptObtained += score;
          aptTotal += q.marks;
        } else if (q.id.startsWith('q_java_') || q.id.startsWith('q_html_') || (q.type === 'mcq' && q.id !== 'q_apt_')) {
          techObtained += score;
          techTotal += q.marks;
        } else if (q.type === 'sql-join') {
          sqlObtained += score;
          sqlTotal += q.marks;
        } else if (q.type === 'coding' || q.type === 'practical-java' || q.type === 'practical-html') {
          codingObtained += score;
          codingTotal += q.marks;
        }
      } else {
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
          techObtained += score;
          techTotal += q.marks;
        }
      }
    });
  }

  const titles: Record<typeof activeTab, [string, string]> = {
    exams: ['Manage exams', 'Create, update, and review exams available in the database.'],
    create: ['Create new exam', 'Build custom exams manually or perform a JSON bulk import.'],
    results: ['Student results', 'Review logs, marks, cheating violations, and download sheets.'],
    analytics: ['Portal analytics', 'A summary of exam statistics, pass rates, and security health.'],
    settings: ['System settings', 'Manage Apps Script webhooks, credentials, and database integration status.'],
  };
  const navItems = [
    { key: 'exams', label: 'Manage Exams', icon: LayoutGrid },
    { key: 'create', label: 'Create Exam', icon: SquarePlus },
    { key: 'results', label: 'Student Results', icon: ClipboardList },
    { key: 'analytics', label: 'Portal Analytics', icon: BarChart3 },
    { key: 'settings', label: 'System Settings', icon: Settings },
  ] as const;
  const qTypes = [
    { k: 'mcq', label: 'MCQ', icon: ListChecks },
    { k: 'coding', label: 'Coding', icon: Code2 },
    { k: 'practical-html', label: 'HTML task', icon: Globe },
    { k: 'practical-java', label: 'Java task', icon: FileCode2 },
    { k: 'tf', label: 'True / False', icon: ToggleLeft },
    { k: 'fib', label: 'Fill blank', icon: TextCursorInput },
    { k: 'sa', label: 'Short answer', icon: AlignLeft },
  ] as const;
  const nowMs = Date.now();
  const examStatus = (e: Exam) => {
    const s = new Date(e.startDate).getTime(), en = new Date(e.endDate).getTime();
    return nowMs < s ? ['Scheduled', 'ui-badge--info'] : nowMs > en ? ['Ended', 'ui-badge--warning'] : ['Live', 'ui-badge--success'];
  };
  const liveTotalMarks = currentQuestions.reduce((sum, q) => sum + q.marks, 0);
  const isOverflow = examPassingMarks > liveTotalMarks;
  const checks = jsonChecks(jsonExamContent);
  const violationBadge = (n: number) => (n === 0 ? 'ui-badge--success' : n < 3 ? 'ui-badge--warning' : 'ui-badge--danger');
  const maxAvg = 100;

  return (
    <div className={`ad ${collapsed ? 'is-collapsed' : ''}`} data-theme={theme}>
      <aside className="ad-side" aria-label="Admin navigation">
        <div className="ad-brand">
          <div className="ad-brand__logo"><ShieldCheck size={22} strokeWidth={1.75} /></div>
          <div className="ad-label"><b>Smart Exam Portal</b><span>Teacher Dashboard</span></div>
        </div>
        <nav className="ad-nav">
          {navItems.map(n => (
            <button key={n.key} className={`ad-nav__btn ${activeTab === n.key ? 'is-active' : ''}`} aria-current={activeTab === n.key ? 'page' : undefined} title={n.label}
              onClick={() => { if (n.key === 'create') setCurrentQuestions([]); setActiveTab(n.key); }}>
              <n.icon size={20} strokeWidth={1.75} /><span className="ad-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="ad-side__foot">
          <button className="ui-btn ui-btn--ghost ad-collapse" onClick={toggleCollapsed} aria-pressed={collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}<span className="ad-label">Collapse</span>
          </button>
          <button className="ui-btn ui-btn--ghost" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}<span className="ad-label">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
          </button>
          <button className="ui-btn ui-btn--secondary logout-btn" onClick={onLogout} title="Exit Admin">
            <LogOut size={18} strokeWidth={1.75} /><span className="ad-label">Exit Admin</span>
          </button>
        </div>
      </aside>

      <div className="ad-main" id="admin-workspace-pane">
        <header className="ad-top">
          <div><h1>{titles[activeTab][0]}</h1><p>{titles[activeTab][1]}</p></div>
          <div className="ad-actions">
            {activeTab === 'exams' && <button className="ui-btn ui-btn--primary" onClick={() => setActiveTab('create')}><Plus size={18} strokeWidth={1.75} /> Create new exam</button>}
            {activeTab === 'create' && (
              <div className="ad-seg" role="tablist" aria-label="Creation mode">
                <button role="tab" aria-selected={creationMode === 'manual'} className={creationMode === 'manual' ? 'is-on' : ''} onClick={() => setCreationMode('manual')}>Manual builder</button>
                <button role="tab" aria-selected={creationMode === 'json'} className={creationMode === 'json' ? 'is-on' : ''} onClick={() => setCreationMode('json')}>JSON bulk import</button>
              </div>
            )}
            {activeTab === 'results' && <button className="ui-btn ui-btn--secondary" onClick={handleExportCSV}><Download size={18} strokeWidth={1.75} /> Download CSV</button>}
          </div>
        </header>

        <div className="ad-body" key={activeTab}>
          {/* =================== EXAMS =================== */}
          {activeTab === 'exams' && (
            <div className="ad-exams ui-stagger">
              {exams.length === 0 ? (
                <div className="ad-empty ad-card">
                  <FileQuestion size={40} strokeWidth={1.5} />
                  <b>No exams yet</b>
                  <p>No exams configured in the database yet. Click 'Create Exam' to get started.</p>
                </div>
              ) : exams.map(exam => {
                const [stLabel, stCls] = examStatus(exam);
                return (
                  <article key={exam.id} className="ad-exam ad-card">
                    <div className="ad-exam__head">
                      <div>
                        <span className={`ui-badge ${stCls}`} style={{ marginBottom: 8 }}>{stLabel}</span>
                        <h3>{exam.title}</h3>
                      </div>
                      <div className="ad-menu">
                        <button className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={`Actions for ${exam.title}`} aria-expanded={menuFor === exam.id} onClick={() => setMenuFor(menuFor === exam.id ? null : exam.id)}>
                          <EllipsisVertical size={18} strokeWidth={1.75} />
                        </button>
                        {menuFor === exam.id && (
                          <div className="ad-menu__list" role="menu">
                            <button role="menuitem" className="ad-menu__item" onClick={() => { setMenuFor(null); handleDeleteExam(exam.id); }}>
                              <Trash2 size={16} strokeWidth={1.75} /> Delete exam
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ad-chips">
                      <span className="ui-chip"><Clock size={14} strokeWidth={1.75} /> {exam.duration} min</span>
                      <span className="ui-chip"><HelpCircle size={14} strokeWidth={1.75} /> {exam.questions.length} questions</span>
                      <span className="ui-chip"><Trophy size={14} strokeWidth={1.75} /> {exam.questions.reduce((s: number, q: any) => s + (q.marks || 0), 0)} marks</span>
                      <span className="ui-chip"><Target size={14} strokeWidth={1.75} /> Pass {exam.passingMarks}</span>
                      <span className="ui-chip"><RotateCcw size={14} strokeWidth={1.75} /> Resume {exam.resumeWindow} min</span>
                    </div>
                    <div className="ad-sched">
                      <CalendarRange size={16} strokeWidth={1.75} />
                      <span>{new Date(exam.startDate).toLocaleString()}<br />to {new Date(exam.endDate).toLocaleString()}</span>
                    </div>
                    <div className="ad-chips">
                      <span className={`ui-badge ${exam.shuffleQuestions ? 'ui-badge--primary' : ''}`} style={exam.shuffleQuestions ? undefined : { background: 'var(--c-surface-2)', color: 'var(--c-text-muted)' }}>Shuffle Qs</span>
                      <span className={`ui-badge ${exam.shuffleOptions ? 'ui-badge--primary' : ''}`} style={exam.shuffleOptions ? undefined : { background: 'var(--c-surface-2)', color: 'var(--c-text-muted)' }}>Shuffle Options</span>
                      <span className={`ui-badge ${exam.showResultToStudent ? 'ui-badge--success' : 'ui-badge--warning'}`}>{exam.showResultToStudent ? 'Results Public' : 'Results Hidden'}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* =================== CREATE =================== */}
          {activeTab === 'create' && creationMode === 'json' && (
            <div className="ad-stack" style={{ maxWidth: 860 }}>
              <section className="ad-card">
                <div className="ad-card__head"><div><h2>JSON / CSV bulk upload</h2><p>Import large exam sets instantly.</p></div></div>
                <div className="ad-card__body">
                  <div
                    className={`ad-drop ${dragOver ? 'is-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]); }}
                  >
                    <input type="file" accept=".csv,.json" onChange={handleFileUpload} style={{ display: 'none' }} id="bulk-file-input" />
                    <label htmlFor="bulk-file-input" style={{ cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 6 }}>
                      <Upload size={28} strokeWidth={1.75} />
                      <b>{dragOver ? 'Drop to upload' : 'Drag & drop a CSV / JSON file, or click to browse'}</b>
                      <span className="ad-tip">.csv or .json</span>
                    </label>
                    {fileName && <span className="ui-badge ui-badge--primary ad-file"><FileText size={14} strokeWidth={1.75} /> Loaded file: {fileName}</span>}
                  </div>

                  <p className="ad-tip">Alternatively, paste structured exam JSON definitions. You can import large exam sets (e.g. 50 MCQs and 4 coding rounds) instantly.</p>
                  <textarea
                    className="ad-textarea ad-mono"
                    rows={12}
                    aria-label="Exam JSON"
                    placeholder={`{\n  "title": "Placement Coding & MCQ Round",\n  "duration": 90,\n  "passingMarks": 40,\n  "resumeWindow": 60,\n  "questions": [\n    {\n      "type": "mcq",\n      "questionText": "What is the complexity of binary search?",\n      "options": ["O(N)", "O(log N)", "O(N log N)", "O(1)"],\n      "correctOptionIndex": 1,\n      "marks": 1\n    },\n    {\n      "type": "coding",\n      "questionText": "Write a function sum(a,b)...",\n      "marks": 15,\n      "codingLanguage": "javascript",\n      "codeTemplate": "function sum(a,b) {\\n}",\n      "testCases": [\n        { "input": "1,2", "expected": "3" }\n      ]\n    }\n  ]\n}`}
                    value={jsonExamContent}
                    onChange={(e) => setJsonExamContent(e.target.value)}
                  ></textarea>

                  {checks.length > 0 && (
                    <ul className="ad-checks-list" aria-label="Validation results">
                      {checks.map((c, i) => (
                        <li key={i} className={c.ok ? 'ok' : 'bad'}>{c.ok ? <CheckCircle2 size={16} strokeWidth={1.75} /> : <XCircle size={16} strokeWidth={1.75} />}<span style={{ color: 'var(--c-text)' }}>{c.label}</span></li>
                      ))}
                    </ul>
                  )}

                  <div><button className="ui-btn ui-btn--primary" onClick={handleJSONBulkImport}><Upload size={18} strokeWidth={1.75} /> Verify &amp; import exam</button></div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'create' && creationMode !== 'json' && (
            <div className="ad-build">
              <div className="ad-stack">
                <section className="ad-card">
                  <div className="ad-card__head"><h2>General details</h2></div>
                  <div className="ad-card__body ad-grid2">
                    <div className="ad-field span2">
                      <label htmlFor="exam-title-input">Exam Title *</label>
                      <input type="text" id="exam-title-input" className="ad-input" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="e.g. Midterm Placement Assessment" required />
                    </div>
                    <div className="ad-field">
                      <label htmlFor="exam-duration-input">Duration (Minutes) *</label>
                      <input type="number" id="exam-duration-input" className="ad-input" value={examDuration} onChange={(e) => setExamDuration(parseInt(e.target.value) || 1)} placeholder="90" min="1" required />
                    </div>
                    <div className="ad-field">
                      <label htmlFor="exam-passing-input">Passing Marks *</label>
                      <input type="number" id="exam-passing-input" className="ad-input" value={examPassingMarks} onChange={(e) => setExamPassingMarks(parseInt(e.target.value) || 0)} placeholder="40" min="0" required />
                    </div>
                    <div className="ad-field">
                      <label htmlFor="exam-resume-input">Resumption Window (Minutes) *</label>
                      <input type="number" id="exam-resume-input" className="ad-input" value={examResumeWindow} onChange={(e) => setExamResumeWindow(parseInt(e.target.value) || 1)} placeholder="60" min="1" required />
                    </div>
                    <div className="ad-field" />
                    <div className="ad-field">
                      <label htmlFor="exam-start-input">Start Date &amp; Time *</label>
                      <input type="datetime-local" id="exam-start-input" className="ad-input" value={examStart} onChange={(e) => setExamStart(e.target.value)} required />
                    </div>
                    <div className="ad-field">
                      <label htmlFor="exam-end-input">End Date &amp; Time *</label>
                      <input type="datetime-local" id="exam-end-input" className="ad-input" value={examEnd} onChange={(e) => setExamEnd(e.target.value)} required />
                    </div>
                    <div className="span2 ad-checks">
                      <label className="ad-check"><input type="checkbox" checked={shuffleQs} onChange={(e) => setShuffleQs(e.target.checked)} /> Shuffle questions order</label>
                      <label className="ad-check"><input type="checkbox" checked={shuffleOpts} onChange={(e) => setShuffleOpts(e.target.checked)} /> Shuffle options</label>
                      <label className="ad-check"><input type="checkbox" checked={showRes} onChange={(e) => setShowRes(e.target.checked)} /> Show results to student immediately</label>
                    </div>
                  </div>
                </section>

                <section className="ad-card">
                  <div className="ad-card__head"><div><h2>Add questions</h2><p>Pick a type, then add it to the exam.</p></div>
                    <button className="ui-btn ui-btn--primary" onClick={handleAddQuestion}><Plus size={18} strokeWidth={1.75} /> Add question</button>
                  </div>
                  <div className="ad-card__body">
                    <div className="ad-types" role="radiogroup" aria-label="Question type">
                      {qTypes.map(t => (
                        <button key={t.k} type="button" role="radio" aria-checked={selectedQType === t.k} className={`ad-type ${selectedQType === t.k ? 'is-on' : ''}`} onClick={() => setSelectedQType(t.k)}>
                          <t.icon size={22} strokeWidth={1.75} />{t.label}
                        </button>
                      ))}
                    </div>

                    {currentQuestions.length === 0 ? (
                      <div className="ad-empty"><p>No questions added yet. Choose a question type and click '+ Add Question'.</p></div>
                    ) : currentQuestions.map((q, qIdx) => {
                      const open = !qCollapsed[q.id];
                      return (
                        <div key={q.id} className="ad-q">
                          <div className="ad-q__head">
                            <GripVertical size={18} strokeWidth={1.75} className="ad-q__grip" aria-hidden="true" />
                            <button type="button" className="ad-q__toggle" aria-expanded={open} onClick={() => setQCollapsed(c => ({ ...c, [q.id]: open }))}>
                              {open ? <ChevronDown size={18} strokeWidth={1.75} /> : <ChevronRight size={18} strokeWidth={1.75} />}
                              Question {qIdx + 1}
                              <span className="ui-badge ui-badge--info">{q.type.toUpperCase()}</span>
                              {!open && <span className="t">{q.questionText || 'No description yet'}</span>}
                            </button>
                            <button className="ui-btn ui-btn--ghost ui-btn--icon" onClick={() => handleDeleteQuestion(qIdx)} aria-label={`Delete question ${qIdx + 1}`}><Trash2 size={18} strokeWidth={1.75} /></button>
                          </div>
                          {open && (
                            <div className="ad-q__body">
                              <div className="ad-field">
                                <label>Question Text / Description *</label>
                                <textarea className="ad-textarea" value={q.questionText} onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)} placeholder="Enter question description..." required />
                              </div>
                              <div className="ad-field" style={{ maxWidth: 140 }}>
                                <label>Question Marks *</label>
                                <input type="number" className="ad-input" value={q.marks} onChange={(e) => handleUpdateQuestionMarks(qIdx, parseInt(e.target.value) || 1)} min="1" required />
                              </div>

                              {q.type === 'mcq' && q.options && (
                                <div className="ad-field">
                                  <label>Options (select the correct one) *</label>
                                  {q.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="ad-opt">
                                      <input type="radio" name={`correct_${q.id}`} value={optIdx} checked={q.correctOptionIndex === optIdx} onChange={() => handleSelectMCQCorrect(qIdx, optIdx)} aria-label={`Option ${optIdx + 1} is correct`} />
                                      <input type="text" className="ad-input" value={opt} onChange={(e) => handleUpdateMCQOption(qIdx, optIdx, e.target.value)} placeholder="Option text..." required />
                                      <button className="ui-btn ui-btn--ghost ui-btn--icon" onClick={() => handleDeleteMCQOption(qIdx, optIdx)} aria-label={`Remove option ${optIdx + 1}`}><X size={18} strokeWidth={1.75} /></button>
                                    </div>
                                  ))}
                                  <div><button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => handleAddMCQOption(qIdx)}><Plus size={16} strokeWidth={1.75} /> Add option</button></div>
                                </div>
                              )}

                              {(q.type === 'coding' || q.type === 'practical-java') && (
                                <>
                                  <div className="ad-field">
                                    <label>Execution Target Language *</label>
                                    <select className="ad-select" value={q.codingLanguage || 'javascript'} onChange={(e) => handleUpdateCodingLang(qIdx, e.target.value)}>
                                      <option value="javascript">JavaScript (Executable Browser Sandbox)</option>
                                      <option value="python">Python (Syntax Mocking)</option>
                                      <option value="cpp">C++ (Syntax Mocking)</option>
                                      <option value="java">Java (Syntax Mocking)</option>
                                    </select>
                                  </div>
                                  <div className="ad-field">
                                    <label>Starter Code Template *</label>
                                    <textarea className="ad-textarea ad-mono" rows={4} value={q.codeTemplate || ''} onChange={(e) => handleUpdateCodingTemplate(qIdx, e.target.value)} placeholder="e.g. function solution() {\n  \n}" />
                                  </div>
                                  <div className="ad-tcs">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <b style={{ fontSize: 13.5 }}>Test cases (required for validation)</b>
                                      <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => handleAddTestCase(qIdx)}><Plus size={16} strokeWidth={1.75} /> Add test case</button>
                                    </div>
                                    {q.testCases?.map((tc, tcIdx) => (
                                      <div key={tcIdx} className="ad-tc">
                                        <input type="text" className="ad-input ad-mono" placeholder="Input arguments (e.g. 2, 3)" value={tc.input} onChange={(e) => handleUpdateTestCase(qIdx, tcIdx, 'input', e.target.value)} />
                                        <input type="text" className="ad-input ad-mono" placeholder="Expected return (e.g. 5)" value={tc.expected} onChange={(e) => handleUpdateTestCase(qIdx, tcIdx, 'expected', e.target.value)} />
                                        <button className="ui-btn ui-btn--ghost ui-btn--icon" onClick={() => handleDeleteTestCase(qIdx, tcIdx)} aria-label={`Remove test case ${tcIdx + 1}`}><X size={18} strokeWidth={1.75} /></button>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}

                              {q.type === 'practical-html' && (
                                <div className="ad-field">
                                  <label>Starter HTML/CSS Template *</label>
                                  <textarea className="ad-textarea ad-mono" rows={6} value={q.codeTemplate || ''} onChange={(e) => handleUpdateCodingTemplate(qIdx, e.target.value)} placeholder="Starter HTML layouts..." />
                                </div>
                              )}

                              {q.type === 'tf' && (
                                <div className="ad-field">
                                  <label>Correct Answer *</label>
                                  <div className="ad-checks">
                                    <label className="ad-check"><input type="radio" name={`tf_correct_${q.id}`} value="true" checked={q.correctAnswer === 'true'} onChange={() => handleSelectTFCorrect(qIdx, 'true')} /> True</label>
                                    <label className="ad-check"><input type="radio" name={`tf_correct_${q.id}`} value="false" checked={q.correctAnswer === 'false'} onChange={() => handleSelectTFCorrect(qIdx, 'false')} /> False</label>
                                  </div>
                                </div>
                              )}

                              {q.type === 'fib' && (
                                <div className="ad-field">
                                  <label>Correct Phrase *</label>
                                  <input type="text" className="ad-input" value={q.correctAnswer || ''} onChange={(e) => handleUpdateTextCorrect(qIdx, e.target.value)} placeholder="Exact answer expected..." required />
                                </div>
                              )}

                              {q.type === 'sa' && (
                                <div className="ad-field">
                                  <label>Correct Answer Guidelines / Key Phrases *</label>
                                  <textarea className="ad-textarea" value={q.correctAnswer || ''} onChange={(e) => handleUpdateTextCorrect(qIdx, e.target.value)} rows={3} placeholder="Reference answer guidelines for grading..." required></textarea>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className={`ad-save ${isOverflow && currentQuestions.length > 0 ? 'is-bad' : ''}`}>
                  <div className="ad-save__stats">
                    <span>Questions <b>{currentQuestions.length}</b></span>
                    <span>Total marks <b>{liveTotalMarks}</b></span>
                    <span>Passing marks <b>{examPassingMarks}</b></span>
                    {isOverflow && currentQuestions.length > 0 && <span className="ad-save__warn"><AlertTriangle size={16} strokeWidth={1.75} /> Passing marks ({examPassingMarks}) exceeds total ({liveTotalMarks})!</span>}
                  </div>
                  <div className="ad-actions">
                    <button className="ui-btn ui-btn--secondary" onClick={() => setActiveTab('exams')}>Cancel</button>
                    <button className="ui-btn ui-btn--primary" onClick={handleSaveExam}><Save size={18} strokeWidth={1.75} /> Save &amp; schedule exam</button>
                  </div>
                </div>
              </div>

              <aside className="ad-card ad-preview" aria-label="Live preview">
                <div className="ad-card__head"><div><h2>Live preview</h2><p>{examTitle || 'Untitled exam'}</p></div><span className="ui-badge ui-badge--primary">{currentQuestions.length} Q</span></div>
                <div className="ad-card__body" style={{ gap: 0 }}>
                  {currentQuestions.length === 0 ? <p className="ad-tip">Questions you add appear here as students will see them.</p> : currentQuestions.map((q, i) => (
                    <div key={q.id} className="ad-pq">
                      <div className="ad-chips"><span className="ui-badge ui-badge--primary">Q{i + 1}</span><span className="ui-badge ui-badge--success">{q.marks} marks</span></div>
                      <p>{q.questionText || <span className="ad-tip">No description yet</span>}</p>
                      {q.type === 'mcq' && q.options?.map((o, oi) => (
                        <div key={oi} className={`ad-pq__o ${q.correctOptionIndex === oi ? 'is-correct' : ''}`}><b className="ui-mono">{String.fromCharCode(65 + oi)}</b> {o || '…'}</div>
                      ))}
                      {q.type === 'tf' && <div className="ad-chips"><span className="ui-chip">Answer: {q.correctAnswer}</span></div>}
                      {(q.type === 'coding' || q.type === 'practical-java' || q.type === 'practical-html') && q.codeTemplate && <pre>{q.codeTemplate}</pre>}
                      {q.testCases && <span className="ad-tip">{q.testCases.length} test case(s)</span>}
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {/* =================== RESULTS =================== */}
          {activeTab === 'results' && (
            <>
              <div className="ad-tools">
                <div className="ad-search">
                  <Search size={18} strokeWidth={1.75} aria-hidden="true" />
                  <input type="text" className="ad-input" placeholder="Search student, roll, or exam..." aria-label="Search results" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <select className="ad-select" style={{ maxWidth: 220 }} aria-label="Filter by exam" value={selectedExamFilter} onChange={(e) => setSelectedExamFilter(e.target.value)}>
                  <option value="All">All Exams</option>
                  {Array.from(new Set(results.map(r => r.examName))).map(exam => (
                    <option key={exam} value={exam}>{exam}</option>
                  ))}
                </select>
                <span className="ad-tip">{filteredResults.length} record(s)</span>
              </div>
              <div className="ad-tablewrap">
                <table className="ad-table">
                  <thead>
                    <tr><th>Student Name</th><th>Roll Number</th><th>Exam Name</th><th>Total Score</th><th>Percentage</th><th>Status</th><th>Violations</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredResults.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: 40 }}>No student records found in the database.</td></tr>
                    ) : filteredResults.map(res => (
                      <tr key={res.id}>
                        <td><strong>{res.studentName}</strong></td>
                        <td className="num">{res.rollNumber}</td>
                        <td>{res.examName}</td>
                        <td className="num">{res.marksObtained} / {res.totalMarks}</td>
                        <td className="num">{res.percentage.toFixed(1)}%</td>
                        <td><span className={`ui-badge ${res.status === 'Pass' ? 'ui-badge--success' : 'ui-badge--danger'}`}>{res.status}</span></td>
                        <td><span className={`ui-badge ${violationBadge(res.totalViolations)}`}>{res.totalViolations} {res.totalViolations === 1 ? 'violation' : 'violations'}</span></td>
                        <td><button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => setSelectedResult(res)}><FileSearch size={16} strokeWidth={1.75} /> Integrity report</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* =================== ANALYTICS =================== */}
          {activeTab === 'analytics' && (totalSubmissions === 0 ? (
            <div className="ad-empty ad-card">
              <BarChart3 size={40} strokeWidth={1.5} />
              <b>No analytics yet</b>
              <p>Analytics require student results. Once students submit exams, charts will generate here.</p>
            </div>
          ) : (
            <>
              <div className="ad-stats ui-stagger">
                <div className="ad-stat ad-card"><div className="ad-stat__icon"><Users size={22} strokeWidth={1.75} /></div><div><span>Total Submissions</span><b>{totalSubmissions}</b></div></div>
                <div className="ad-stat ad-card"><div className="ad-stat__icon"><Percent size={22} strokeWidth={1.75} /></div><div><span>Average Score</span><b>{avgPercentage.toFixed(1)}%</b></div></div>
                <div className="ad-stat ad-card"><div className="ad-stat__icon"><TrendingUp size={22} strokeWidth={1.75} /></div><div><span>Class Pass Rate</span><b>{passRate.toFixed(1)}%</b></div></div>
                <div className="ad-stat ad-card"><div className="ad-stat__icon is-danger"><AlertTriangle size={22} strokeWidth={1.75} /></div><div><span>Total Integrity Alerts</span><b>{totalViolationsCount}</b></div></div>
              </div>

              <div className="ad-charts">
                <section className="ad-card">
                  <div className="ad-card__head"><h2>Completion outcomes (pass vs fail)</h2></div>
                  <div className="ad-card__body ad-donut">
                    <svg width="200" height="200" viewBox="0 0 120 120" role="img" aria-label={`Pass ${passCount}, fail ${failCount}`}>
                      <circle cx="60" cy="60" r={pieRadius} fill="transparent" stroke="var(--c-surface-2)" strokeWidth="12" />
                      <circle cx="60" cy="60" r={pieRadius} fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={`${passStrokeDash} ${pieCircum}`} />
                      <circle cx="60" cy="60" r={pieRadius} fill="transparent" stroke="#f43f5e" strokeWidth="12" strokeDasharray={`${failStrokeDash} ${pieCircum}`} strokeDashoffset={`-${passStrokeDash}`} />
                    </svg>
                    <div className="ad-legend">
                      <span><i style={{ background: '#10b981' }}></i>Pass: {passCount} ({passRate.toFixed(0)}%)</span>
                      <span><i style={{ background: '#f43f5e' }}></i>Fail: {failCount} ({(100 - passRate).toFixed(0)}%)</span>
                    </div>
                  </div>
                </section>

                <section className="ad-card">
                  <div className="ad-card__head"><h2>Integrity violation breakdown</h2></div>
                  <div className="ad-card__body ad-hbar">
                    {[['Tab switches', tabCount], ['Fullscreen exit', fsCount], ['Mic activity', micCount], ['Cam disabled', camCount]].map(([label, n]) => (
                      <div key={label as string} className="ad-hbar__row">
                        <span>{label}</span>
                        <div className="ad-hbar__track"><div className="ad-hbar__fill" style={{ width: `${totalViolationsCount > 0 ? ((n as number) / totalViolationsCount) * 100 : 0}%` }}></div></div>
                        <span className="ad-hbar__val">{n}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="ad-card" style={{ marginTop: 'var(--sp-4)' }}>
                <div className="ad-card__head"><h2>Performance by exam title</h2><span className="ad-tip">Average score (%)</span></div>
                <div className="ad-card__body">
                  <div className="ad-vbar">
                    <div className="ad-vbar__y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
                    <div className="ad-vbar__plot">
                      <div className="ad-vbar__grid"></div>
                      {chartExams.map(ce => (
                        <div key={ce.name} className="ad-vbar__col">
                          <div className="ad-vbar__area">
                            <div className="ad-vbar__bar" style={{ height: `${Math.min(ce.avg, maxAvg)}%` }}>
                              <span className="ad-vbar__val">{ce.avg.toFixed(0)}%</span>
                              <span className="ad-vbar__tip" role="tooltip">{ce.name}: {ce.avg.toFixed(1)}%</span>
                            </div>
                          </div>
                          <span className="ad-vbar__name" title={ce.name}>{ce.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          ))}

          {/* =================== SETTINGS =================== */}
          {activeTab === 'settings' && (
            <div className="ad-settings">
              <section className="ad-card">
                <div className="ad-card__head"><div><h2>Configuration details</h2><p>Webhook endpoint and portal credentials.</p></div></div>
                <div className="ad-card__body">
                  <div className="ad-field">
                    <label htmlFor="settings-script-url">Google Apps Script Web App URL</label>
                    <input
                      type="url"
                      id="settings-script-url"
                      className="ad-input"
                      defaultValue={settings.googleAppsScriptUrl}
                      placeholder="https://script.google.com/macros/s/..."
                      ref={(el) => { if (el) (el as any)._scriptUrl = el.value; }}
                      onBlur={(e) => { (e.target as any)._scriptUrl = e.target.value; }}
                    />
                    <p className="ad-tip">All student responses will automatically post to this endpoint when exams are completed.</p>
                  </div>

                  <div className="ad-field">
                    <label htmlFor="settings-admin-pass">Admin/Teacher Portal Password</label>
                    <input
                      type="password"
                      id="settings-admin-pass"
                      className="ad-input"
                      defaultValue={settings.adminPassword}
                      ref={(el) => { if (el) (el as any)._adminPass = el.value; }}
                      onBlur={(e) => { (e.target as any)._adminPass = e.target.value; }}
                      placeholder="Enter new admin password"
                    />
                    <p className="ad-tip">Used to sign in at /admin.</p>
                  </div>

                  <div>
                    <button
                      className="ui-btn ui-btn--primary"
                      onClick={(e) => {
                        const container = e.currentTarget.parentElement?.parentElement;
                        const urlInput = container?.querySelector('#settings-script-url') as HTMLInputElement;
                        const passInput = container?.querySelector('#settings-admin-pass') as HTMLInputElement;
                        if (urlInput && passInput) {
                          handleUpdateSettings(urlInput.value, passInput.value);
                        }
                      }}
                    >
                      <Save size={18} strokeWidth={1.75} /> Update configurations
                    </button>
                  </div>
                </div>
              </section>

              <section className="ad-card">
                <div className="ad-card__head"><div><h2>Google Spreadsheet deployment guide</h2><p>To view submissions in your Google Sheet:</p></div></div>
                <div className="ad-card__body">
                  <ol className="ad-steps">
                    <li><span>Create a new Google Sheet.</span></li>
                    <li><span>Go to <strong>Extensions &gt; Apps Script</strong>.</span></li>
                    <li><span>Delete any existing code and copy-paste the template file contents from <code>google_script_template.js</code>.</span></li>
                    <li><span>Click <strong>Deploy &gt; New Deployment</strong>.</span></li>
                    <li><span>Set <em>Select type</em> to <strong>Web App</strong>.</span></li>
                    <li><span>Set <em>Execute as</em> to <strong>Me</strong>.</span></li>
                    <li><span>Set <em>Who has access</em> to <strong>Anyone</strong> (necessary for client-side API requests).</span></li>
                    <li><span>Click <strong>Deploy</strong>, authorize the permissions, and copy the generated <strong>Web App URL</strong>.</span></li>
                    <li><span>Paste the URL into the settings box and click "Update configurations".</span></li>
                  </ol>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="ad-scrim ad-scrim--center modal-overlay" role="presentation" onClick={() => setPendingDelete(null)}>
          <div className="ad-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ad-del-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="ad-del-title">Delete exam?</h3>
            <p>Are you sure you want to permanently delete this exam from the database? This action cannot be undone.</p>
            <div className="ad-dialog__actions">
              <button className="ui-btn ui-btn--secondary" onClick={() => setPendingDelete(null)} autoFocus>Cancel</button>
              <button className="ui-btn ui-btn--danger" onClick={() => confirmDeleteExam(pendingDelete)}><Trash2 size={18} strokeWidth={1.75} /> Delete permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* Integrity report drawer (legacy modal-* classes kept for print styles) */}
      {selectedResult && (
        <div className="ad-scrim modal-overlay" role="presentation" onClick={() => setSelectedResult(null)}>
          <aside className="ad-drawer modal-card" role="dialog" aria-modal="true" aria-label="Integrity report" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Audit report: {selectedResult.studentName} ({selectedResult.rollNumber})</h3>
              <button className="ui-btn ui-btn--ghost ui-btn--icon close-modal-btn" onClick={() => setSelectedResult(null)} aria-label="Close report"><X size={20} strokeWidth={1.75} /></button>
            </div>

            <div className="modal-body">
              <div className="print-printable-area">
                <div className="print-only print-header-block">
                  <h2>Smart Exam Portal - Student Certificate &amp; Audit Report</h2>
                  <p>Generated: {new Date().toLocaleString()}</p>
                  <hr />
                </div>

                <div className="modal-info-summary ad-sum">
                  <div>Exam name<b>{selectedResult.examName}</b></div>
                  <div>Completion date<b>{selectedResult.date}</b></div>
                  <div>Time taken<b className="ui-mono">{selectedResult.timeTaken}</b></div>
                  <div>Final score<b className="ui-mono">{selectedResult.marksObtained} / {selectedResult.totalMarks} ({selectedResult.percentage.toFixed(1)}%)</b></div>
                  <div>Status<b><span className={`ui-badge ${selectedResult.status === 'Pass' ? 'ui-badge--success' : 'ui-badge--danger'}`}>{selectedResult.status}</span></b></div>
                  <div>Total violations<b><span className={`ui-badge ${violationBadge(selectedResult.totalViolations)}`}>{selectedResult.totalViolations}</span></b></div>
                </div>

                {matchingExam && (
                  <div className="report-section ad-sec">
                    <h4>Detailed sectional grade breakdown</h4>
                    <div className="ad-grade">
                      {isFinalExam ? (
                        <>
                          <div>1. Aptitude &amp; Reasoning (MCQs)<b>{aptObtained} / {aptTotal}</b></div>
                          <div>2. Technical Core (Java/HTML MCQs)<b>{techObtained} / {techTotal}</b></div>
                          <div>3. SQL JOIN Queries (Written)<b>{sqlObtained} / {sqlTotal}</b></div>
                          <div>4. Coding &amp; Practical Round (Java &amp; HTML)<b>{codingObtained} / {codingTotal}</b></div>
                        </>
                      ) : (
                        <>
                          <div>1. Aptitude &amp; Verbal (MCQs)<b>{aptObtained} / {aptTotal}</b></div>
                          <div>2. Technical Core (Java/HTML/DSA)<b>{techObtained} / {techTotal}</b></div>
                          <div>3. Coding Round (Leetcode Problems)<b>{codingObtained} / {codingTotal}</b></div>
                          <div>4. Practical Tasks (HTML Form/Calculator)<b>{pracObtained} / {pracTotal}</b></div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="report-section ad-sec">
                  <h4>Anti-cheating log</h4>
                  {selectedResult.violationLog.length === 0 ? (
                    <div className="clean-audit ad-clean"><CheckCircle2 size={18} strokeWidth={1.75} /> Perfect Integrity. No browser violations detected.</div>
                  ) : (
                    <div className="violations-table-mini ad-vlog">
                      <div className="v-header"><span>Time</span><span>Violation type</span><span>Warning #</span></div>
                      {selectedResult.violationLog.map((v, index) => (
                        <div key={index} className="v-row"><span>{v.time}</span><span className="vt v-type">{v.type}</span><span>{v.warningNumber || '-'}</span></div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedResult.cameraCaptures && selectedResult.cameraCaptures.length > 0 && (
                  <div className="report-section ad-sec">
                    <h4>Webcam audits ({selectedResult.cameraCaptures.length})</h4>
                    <div className="scrolling-captures" style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                      {selectedResult.cameraCaptures.map((snap, idx) => (
                        <div key={idx} className="capture-card" style={{ flexShrink: 0 }}>
                          <img src={snap.image} alt={`Cap @ ${snap.timestamp}`} style={{ borderRadius: 6 }} />
                          <span style={{ fontSize: 10, textAlign: 'center', color: 'var(--c-text-muted)' }}>{snap.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedResult.answers && Object.keys(selectedResult.answers).length > 0 && (
                  <div className="report-section ad-sec">
                    <h4>Submitted answers summary</h4>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {Object.entries(selectedResult.answers).map(([qId, ans]) => (
                        <div key={qId} className="ad-ans">
                          <small>Question ID: {qId}</small>
                          {ans.startsWith('//') || ans.includes('function') || ans.includes('def ') || ans.includes('<html') ? (
                            <pre>{ans}</pre>
                          ) : (
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{ans}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="ui-btn ui-btn--secondary" onClick={handlePrintResult}><Printer size={18} strokeWidth={1.75} /> Print report / Save PDF</button>
              <button className="ui-btn ui-btn--primary" onClick={() => setSelectedResult(null)}>Close</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
