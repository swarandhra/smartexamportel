// db.ts - Neon PostgreSQL API Client
// All database operations now go through the Express API server (or Vercel serverless functions in production)

const API_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') 
  : (import.meta.env.PROD ? '' : 'http://localhost:3001');

export interface Question {
  id: string;
  type: 'mcq' | 'tf' | 'fib' | 'sa' | 'coding' | 'practical-html' | 'practical-java';
  questionText: string;
  options?: string[];
  correctOptionIndex?: number;
  correctAnswer?: string;
  marks: number;
  codingLanguage?: 'javascript' | 'python' | 'cpp' | 'java';
  codeTemplate?: string;
  testCases?: Array<{ input: string; expected: string }>;
}

export interface Exam {
  id: string;
  title: string;
  duration: number;
  startDate: string;
  endDate: string;
  passingMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultToStudent: boolean;
  resumeWindow: number;
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
  image: string;
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
  answers: Record<string, string>;
}

export interface Settings {
  googleAppsScriptUrl: string;
  adminPassword: string;
}

export interface LocalExamState {
  answers: Record<string, string>;
  activeQuestionIndex: number;
  secondsRemaining: number;
  resultId?: string;
}

const EXAMS_KEY = 'smart_exam_portal_exams';
const RESULTS_KEY = 'smart_exam_portal_results';
const SETTINGS_KEY = 'smart_exam_portal_settings';

const DEFAULT_SETTINGS: Settings = {
  googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbz_SAMPLE_URL/exec',
  adminPassword: import.meta.env.VITE_ADMIN_PASSWORD || 'Venky@80744'
};

export function getSettings(): Settings {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  const parsed = JSON.parse(data);
  if (parsed.adminPassword === 'admin' || parsed.adminPassword === 'Venky@905') {
    parsed.adminPassword = 'Venky@80744';
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
  }
  return { ...DEFAULT_SETTINGS, ...parsed };
}

export function saveSettings(settings: Partial<Settings>): void {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

// ─── Helper ──────────────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { success: res.ok };
  } catch (e: any) {
    console.error("API response parse error:", text, res.status);
    throw new Error(`Failed to parse JSON response. Status: ${res.status}. Body: ${text.slice(0, 50)}...`);
  }
}

// ─── Local Fallbacks ─────────────────────────────────────────────
function getLocalExamsFallback(): Exam[] {
  const data = localStorage.getItem(EXAMS_KEY);
  return data ? JSON.parse(data) : [];
}

function getLocalResultsFallback(): Result[] {
  const data = localStorage.getItem(RESULTS_KEY);
  return data ? JSON.parse(data) : [];
}

// ─── STUDENT AUTH ─────────────────────────────────────────────────

export async function registerStudent(rollNumber: string, name: string, password: string, branch: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await apiFetch('/api/students/register', {
      method: 'POST',
      body: JSON.stringify({ rollNumber, name, password, branch })
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function authenticateStudent(rollNumber: string, password: string): Promise<{ success: boolean; student?: { name: string; rollNumber: string }; error?: string }> {
  try {
    return await apiFetch('/api/students/login', {
      method: 'POST',
      body: JSON.stringify({ rollNumber, password })
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── EXAMS ────────────────────────────────────────────────────────

export async function getExams(): Promise<Exam[]> {
  try {
    const res = await apiFetch('/api/exams');
    if (res.success) {
      localStorage.setItem(EXAMS_KEY, JSON.stringify(res.data));
      return res.data;
    }
    return getLocalExamsFallback();
  } catch (e) {
    return getLocalExamsFallback();
  }
}

export async function addExam(exam: Exam): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiFetch('/api/exams', {
      method: 'POST',
      body: JSON.stringify(exam)
    });
    if (res.success) {
      const local = getLocalExamsFallback().filter(e => e.id !== exam.id);
      local.push(exam);
      localStorage.setItem(EXAMS_KEY, JSON.stringify(local));
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteExam(examId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiFetch(`/api/exams/${examId}`, { method: 'DELETE' });
    if (res.success) {
      const local = getLocalExamsFallback().filter(e => e.id !== examId);
      localStorage.setItem(EXAMS_KEY, JSON.stringify(local));
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── RESULTS ─────────────────────────────────────────────────────

export async function getResults(): Promise<Result[]> {
  try {
    const res = await apiFetch('/api/results');
    if (res.success) return res.data;
    return getLocalResultsFallback();
  } catch (e) {
    return getLocalResultsFallback();
  }
}

export async function checkActiveDraft(rollNumber: string, examId: string): Promise<Result | null> {
  try {
    const res = await apiFetch(`/api/results/draft?rollNumber=${encodeURIComponent(rollNumber)}&examId=${encodeURIComponent(examId)}`);
    return res.success ? res.data : null;
  } catch (e) {
    return null;
  }
}

export async function updateResultDraft(
  resultId: string,
  answers: Record<string, string>,
  violationLog: Violation[],
  cameraCaptures: CameraCapture[]
): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/results/${resultId}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ answers, violationLog, cameraCaptures })
    });
    return res.success;
  } catch (e) {
    return false;
  }
}

export async function addResult(result: Result): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiFetch('/api/results', {
      method: 'POST',
      body: JSON.stringify(result)
    });
    if (res.success) {
      const local = getLocalResultsFallback().filter(r => r.id !== result.id);
      local.push(result);
      localStorage.setItem(RESULTS_KEY, JSON.stringify(local));
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── LOCAL EXAM STATE ─────────────────────────────────────────────

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

// ─── OFFLINE QUEUE ────────────────────────────────────────────────

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
