// db.js - LocalStorage Database Wrapper

const EXAMS_KEY = 'smart_exam_portal_exams';
const RESULTS_KEY = 'smart_exam_portal_results';
const SETTINGS_KEY = 'smart_exam_portal_settings';

// Default App Settings
const DEFAULT_SETTINGS = {
  googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbz_SAMPLE_URL/exec',
  adminPassword: 'admin' // Simple password for teacher access
};

// Seed exams if none exist
const SEED_EXAMS = [
  {
    id: 'exam_demo_1',
    title: 'General Knowledge & Science Demo',
    duration: 10, // 10 minutes
    startDate: new Date(Date.now() - 3600000).toISOString().slice(0, 16), // Started an hour ago
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),  // Ends tomorrow
    passingMarks: 15,
    shuffleQuestions: true,
    shuffleOptions: true,
    showResultToStudent: true,
    questions: [
      {
        id: 'q_demo_1',
        type: 'mcq',
        questionText: 'Which planet is known as the Red Planet?',
        options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
        correctOptionIndex: 1,
        marks: 5
      },
      {
        id: 'q_demo_2',
        type: 'tf',
        questionText: 'Light travels faster than sound.',
        correctAnswer: 'true',
        marks: 5
      },
      {
        id: 'q_demo_3',
        type: 'fib',
        questionText: 'Water is composed of oxygen and _________ atoms.',
        correctAnswer: 'hydrogen',
        marks: 5
      },
      {
        id: 'q_demo_4',
        type: 'sa',
        questionText: 'Briefly explain what photosynthesis is and why it is important.',
        correctAnswer: 'Photosynthesis is the process by which plants make food using sunlight, carbon dioxide, and water. It produces oxygen, which is essential for life.',
        marks: 10
      }
    ]
  },
  {
    id: 'exam_demo_2',
    title: 'Web Security & Integrity Quiz',
    duration: 5,
    startDate: new Date(Date.now() - 1800000).toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 1800000).toISOString().slice(0, 16),
    passingMarks: 10,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResultToStudent: false, // Student cannot see result immediately
    questions: [
      {
        id: 'q_sec_1',
        type: 'mcq',
        questionText: 'What does HTTPS stand for?',
        options: [
          'Hypertext Transfer Protocol Secure',
          'High Transfer Processor System',
          'Hyperlink Text Private Security',
          'Home Technology Port Shield'
        ],
        correctOptionIndex: 0,
        marks: 10
      },
      {
        id: 'q_sec_2',
        type: 'tf',
        questionText: 'Clearing LocalStorage will wipe student answers saved during disconnection.',
        correctAnswer: 'true',
        marks: 5
      }
    ]
  }
];

export function getSettings() {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
}

export function saveSettings(settings) {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

export function getExams() {
  const data = localStorage.getItem(EXAMS_KEY);
  if (!data) {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(SEED_EXAMS));
    return SEED_EXAMS;
  }
  return JSON.parse(data);
}

export function saveExams(exams) {
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
}

export function addExam(exam) {
  const exams = getExams();
  exams.push(exam);
  saveExams(exams);
  return exam;
}

export function deleteExam(examId) {
  let exams = getExams();
  exams = exams.filter(e => e.id !== examId);
  saveExams(exams);
}

export function getResults() {
  const data = localStorage.getItem(RESULTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveResults(results) {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

export function addResult(result) {
  const results = getResults();
  results.push(result);
  saveResults(results);
  return result;
}

// Active exam local autosave storage (for browser crashes or internet disconnects)
export function getLocalExamState(studentRoll, examId) {
  const key = `exam_state_${studentRoll}_${examId}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export function saveLocalExamState(studentRoll, examId, state) {
  const key = `exam_state_${studentRoll}_${examId}`;
  localStorage.setItem(key, JSON.stringify(state));
}

export function clearLocalExamState(studentRoll, examId) {
  const key = `exam_state_${studentRoll}_${examId}`;
  localStorage.removeItem(key);
}

// Queue for results that failed to upload because of offline status
export function getOfflineQueue() {
  const data = localStorage.getItem('failed_uploads_queue');
  return data ? JSON.parse(data) : [];
}

export function addToOfflineQueue(result) {
  const queue = getOfflineQueue();
  queue.push(result);
  localStorage.setItem('failed_uploads_queue', JSON.stringify(queue));
}

export function clearOfflineQueue() {
  localStorage.removeItem('failed_uploads_queue');
}
