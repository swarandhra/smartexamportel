// db.ts - Supabase Client Wrapper & Local Cache Fallbacks
import { createClient } from './supabase/client';

export interface Question {
  id: string;
  type: 'mcq' | 'tf' | 'fib' | 'sa' | 'coding' | 'practical-html' | 'practical-java';
  questionText: string;
  options?: string[]; // for mcq
  correctOptionIndex?: number; // for mcq
  correctAnswer?: string; // for tf ('true'/'false'), fib, sa, and practical evaluations
  marks: number;
  // Coding attributes
  codingLanguage?: 'javascript' | 'python' | 'cpp' | 'java';
  codeTemplate?: string;
  testCases?: Array<{ input: string; expected: string }>;
}

export interface Exam {
  id: string;
  title: string;
  duration: number; // minutes
  startDate: string; // ISO string
  endDate: string; // ISO string
  passingMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultToStudent: boolean;
  resumeWindow: number; // in minutes
  questions: Question[];
}

export interface Violation {
  time: string;
  type: string;
  warningNumber: number | null;
  details: string;
}

export interface CameraCapture {
  timestamp: string;
  image: string; // base64 URL
}

export interface Result {
  id: string;
  examId: string;
  examName: string;
  studentName: string;
  rollNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  timeTaken: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  status: 'Draft' | 'Pass' | 'Fail';
  isSubmitted: boolean;
  cameraViolations: number;
  microphoneViolations: number;
  fullscreenViolations: number;
  tabSwitchingCount: number;
  totalViolations: number;
  violationLog: Violation[];
  cameraCaptures: CameraCapture[];
  answers: Record<string, string>; // student inputs
}

export interface Settings {
  googleAppsScriptUrl: string;
  adminPassword:  string;
}

export interface LocalExamState {
  answers: Record<string, string>;
  activeQuestionIndex: number;
  secondsRemaining: number;
  resultId?: string; // Tracks database draft result ID
}

const EXAMS_KEY = 'smart_exam_portal_exams';
const RESULTS_KEY = 'smart_exam_portal_results';
const SETTINGS_KEY = 'smart_exam_portal_settings';

const DEFAULT_SETTINGS: Settings = {
  googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbz_SAMPLE_URL/exec',
  adminPassword: import.meta.env.VITE_ADMIN_PASSWORD || 'Venky@905'
};

const SEED_EXAMS: Exam[] = [];

export function getSettings(): Settings {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  const parsed = JSON.parse(data);
  if (parsed.adminPassword === 'admin') {
    parsed.adminPassword = 'Venky@905';
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
  }
  return { ...DEFAULT_SETTINGS, ...parsed };
}

export function saveSettings(settings: Partial<Settings>): void {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

// Student Registration and Authentication
export async function registerStudent(rollNumber: string, name: string, password: string, branch: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('students')
      .insert([{ 
        roll_number: rollNumber.trim().toUpperCase(), 
        name: name.trim(), 
        password: password.trim(),
        branch: branch.trim().toUpperCase()
      }]);
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Student with this Roll Number is already registered.' };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function authenticateStudent(rollNumber: string, password: string): Promise<{ success: boolean; student?: { name: string; rollNumber: string }; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('roll_number', rollNumber.trim().toUpperCase())
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) {
      return { success: false, error: 'Student not found. Please register first.' };
    }
    if (data.password !== password.trim()) {
      return { success: false, error: 'Invalid password. Please check your credentials.' };
    }
    return { success: true, student: { name: data.name, rollNumber: data.roll_number } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Local fallback getters (in case Supabase schema is not yet provisioned)
function getLocalExamsFallback(): Exam[] {
  const data = localStorage.getItem(EXAMS_KEY);
  if (!data) {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(SEED_EXAMS));
    return SEED_EXAMS;
  }
  return JSON.parse(data);
}

function getLocalResultsFallback(): Result[] {
  const data = localStorage.getItem(RESULTS_KEY);
  return data ? JSON.parse(data) : [];
}

// Scheduled Exam Operations
export async function getExams(): Promise<Exam[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase exams fetch error. Falling back to local cache:', error.message);
      return getLocalExamsFallback();
    }

    if (!data || data.length === 0) {
      // Seed default exams in Supabase if empty
      for (const ex of SEED_EXAMS) {
        await addExam(ex);
      }
      return SEED_EXAMS;
    }

    return data.map((e: any) => ({
      id: e.id,
      title: e.title,
      duration: e.duration,
      passingMarks: e.passing_marks,
      startDate: e.start_date,
      endDate: e.end_date,
      shuffleQuestions: e.shuffle_questions,
      shuffleOptions: e.shuffle_options,
      showResultToStudent: e.show_result_to_student,
      resumeWindow: e.resume_window || 60,
      questions: e.questions
    }));
  } catch (e: any) {
    console.warn('Supabase offline fallback:', e.message);
    return getLocalExamsFallback();
  }
}

export async function addExam(exam: Exam): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const payload = {
      id: exam.id,
      title: exam.title,
      duration: exam.duration,
      passing_marks: exam.passingMarks,
      start_date: exam.startDate,
      end_date: exam.endDate,
      shuffle_questions: exam.shuffleQuestions,
      shuffle_options: exam.shuffleOptions,
      show_result_to_student: exam.showResultToStudent,
      resume_window: exam.resumeWindow || 60,
      questions: exam.questions
    };

    const { error } = await supabase.from('exams').insert([payload]);
    if (error) {
      return { success: false, error: error.message };
    }

    // Sync to local fallback
    const local = getLocalExamsFallback().filter(e => e.id !== exam.id);
    local.push(exam);
    localStorage.setItem(EXAMS_KEY, JSON.stringify(local));

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteExam(examId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('exams').delete().eq('id', examId);
    if (error) {
      return { success: false, error: error.message };
    }

    // Sync local fallback
    const local = getLocalExamsFallback().filter(e => e.id !== examId);
    localStorage.setItem(EXAMS_KEY, JSON.stringify(local));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Student Results & Session Resumption Operations
export async function getResults(): Promise<Result[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase results fetch error. Falling back to local cache:', error.message);
      return getLocalResultsFallback();
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      examId: r.exam_id,
      examName: r.exam_name,
      studentName: r.student_name,
      rollNumber: r.roll_number,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      timeTaken: r.time_taken,
      totalQuestions: r.total_questions,
      correctAnswers: r.correct_answers,
      wrongAnswers: r.wrong_answers,
      marksObtained: r.marks_obtained,
      totalMarks: r.total_marks,
      percentage: Number(r.percentage),
      status: r.status,
      isSubmitted: r.is_submitted,
      cameraViolations: r.camera_violations,
      microphoneViolations: r.microphone_violations,
      fullscreenViolations: r.fullscreen_violations,
      tabSwitchingCount: r.tab_switching_count,
      totalViolations: r.total_violations,
      violationLog: r.violation_log,
      cameraCaptures: r.camera_captures,
      answers: r.answers
    }));
  } catch (e: any) {
    return getLocalResultsFallback();
  }
}

// Check if a student has an unsubmitted active exam draft that falls inside the resumption window
export async function checkActiveDraft(rollNumber: string, examId: string): Promise<Result | null> {
  try {
    const supabase = createClient();
    // Get exam configuration details first to check window size
    const { data: examData, error: examErr } = await supabase.from('exams').select('resume_window').eq('id', examId).maybeSingle();
    const windowMinutes = examErr || !examData ? 60 : examData.resume_window;

    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('roll_number', rollNumber.trim().toUpperCase())
      .eq('exam_id', examId)
      .eq('is_submitted', false)
      .maybeSingle();

    if (error || !data) return null;

    // Check time window elapsed since created_at
    const start = new Date(data.created_at).getTime();
    const now = new Date().getTime();
    const elapsedMinutes = (now - start) / 60000;

    if (elapsedMinutes < windowMinutes) {
      return {
        id: data.id,
        examId: data.exam_id,
        examName: data.exam_name,
        studentName: data.student_name,
        rollNumber: data.roll_number,
        date: data.date,
        startTime: data.start_time,
        endTime: data.end_time,
        timeTaken: data.time_taken,
        totalQuestions: data.total_questions,
        correctAnswers: data.correct_answers,
        wrongAnswers: data.wrong_answers,
        marksObtained: data.marks_obtained,
        totalMarks: data.total_marks,
        percentage: Number(data.percentage),
        status: data.status,
        isSubmitted: data.is_submitted,
        cameraViolations: data.camera_violations,
        microphoneViolations: data.microphone_violations,
        fullscreenViolations: data.fullscreen_violations,
        tabSwitchingCount: data.tab_switching_count,
        totalViolations: data.total_violations,
        violationLog: data.violation_log,
        cameraCaptures: data.camera_captures,
        answers: data.answers
      };
    } else {
      // Mark elapsed drafts as submitted automatically
      await supabase.from('results').update({ is_submitted: true }).eq('id', data.id);
    }
  } catch (e) {
    console.error('Draft verify failed:', e);
  }
  return null;
}

// Live draft updates sent to Supabase during the exam
export async function updateResultDraft(
  resultId: string, 
  answers: Record<string, string>, 
  violationLog: Violation[], 
  cameraCaptures: CameraCapture[]
): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Sum violation counts
    const cameraViolations = violationLog.filter(l => l.type.includes('Camera')).length;
    const microphoneViolations = violationLog.filter(l => l.type.includes('Voice')).length;
    const fullscreenViolations = violationLog.filter(l => l.type.includes('Fullscreen')).length;
    const tabSwitchingCount = violationLog.filter(l => l.type.includes('Tab') || l.type.includes('Unfocus')).length;
    
    const { error } = await supabase
      .from('results')
      .update({
        answers,
        violation_log: violationLog,
        camera_captures: cameraCaptures,
        camera_violations: cameraViolations,
        microphone_violations: microphoneViolations,
        fullscreen_violations: fullscreenViolations,
        tab_switching_count: tabSwitchingCount,
        total_violations: violationLog.length
      })
      .eq('id', resultId)
      .eq('is_submitted', false);

    return !error;
  } catch (e) {
    return false;
  }
}

export async function addResult(result: Result): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const payload = {
      id: result.id,
      exam_id: result.examId,
      exam_name: result.examName,
      student_name: result.studentName,
      roll_number: result.rollNumber,
      date: result.date,
      start_time: result.startTime,
      end_time: result.endTime,
      time_taken: result.timeTaken,
      total_questions: result.totalQuestions,
      correct_answers: result.correctAnswers,
      wrong_answers: result.wrongAnswers,
      marks_obtained: result.marksObtained,
      total_marks: result.totalMarks,
      percentage: result.percentage,
      status: result.status,
      is_submitted: result.isSubmitted,
      camera_violations: result.cameraViolations,
      microphone_violations: result.microphoneViolations,
      fullscreen_violations: result.fullscreenViolations,
      tab_switching_count: result.tabSwitchingCount,
      total_violations: result.totalViolations,
      violation_log: result.violationLog,
      camera_captures: result.cameraCaptures,
      answers: result.answers
    };

    // Upsert so if a draft already exists, it is finalized, else inserted new
    const { error } = await supabase.from('results').upsert([payload]);
    if (error) {
      return { success: false, error: error.message };
    }

    // Sync local fallback
    const local = getLocalResultsFallback().filter(r => r.id !== result.id);
    local.push(result);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(local));

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Temporary Local Exam Session Drafts (saved in LocalStorage during exam in case browser tab crashes)
export function getLocalExamState(studentRoll: string, examId: string): LocalExamState | null {
  const key = `exam_state_${studentRoll}_${examId}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export function saveLocalExamState(studentRoll: string, examId: string, state: LocalExamState): void {
  const key = `exam_state_${studentRoll}_${examId}`;
  localStorage.setItem(key, JSON.stringify(state));
}

export function clearLocalExamState(studentRoll: string, examId: string): void {
  const key = `exam_state_${studentRoll}_${examId}`;
  localStorage.removeItem(key);
}

// Offline Upload Queue helpers
export function getOfflineQueue(): Result[] {
  const data = localStorage.getItem('failed_uploads_queue');
  return data ? JSON.parse(data) : [];
}

export function addToOfflineQueue(result: Result): void {
  const queue = getOfflineQueue();
  queue.push(result);
  localStorage.setItem('failed_uploads_queue', JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem('failed_uploads_queue');
}
