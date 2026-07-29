import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import AdminLogin from './components/AdminLogin';
import StudentDashboard from './components/StudentDashboard';
import VerificationScreen from './components/VerificationScreen';
import ExamEngine from './components/ExamEngine';
import OutcomeScreen from './components/OutcomeScreen';
import AdminDashboard from './components/AdminDashboard';
import type { Exam, Result } from './utils/db';
import { syncOfflineResults } from './utils/helpers';

// Detect if current URL path is /admin
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname === '/admin/';

export default function App() {
  const [role, setRole] = useState<'student' | 'admin' | null>(null);
  const [studentSession, setStudentSession] = useState<{ name: string; rollNumber: string } | null>(null);
  
  // Student exam flows: 'dashboard' | 'verification' | 'exam' | 'outcome'
  const [examState, setExamState] = useState<'dashboard' | 'verification' | 'exam' | 'outcome'>('dashboard');
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeResult, setActiveResult] = useState<Result | null>(null);
  const [activeDraft, setActiveDraft] = useState<Result | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Sync session states from local storage on mount
  useEffect(() => {
    const adminActive = localStorage.getItem('active_role') === 'admin';
    const studentActiveRaw = localStorage.getItem('active_student');

    // If we're on the /admin route, only restore admin sessions
    if (isAdminRoute) {
      if (adminActive) setRole('admin');
      return;
    }

    if (adminActive) {
      // Non-admin URL but admin session exists: redirect to /admin
      window.location.href = '/admin';
      return;
    }

    if (studentActiveRaw) {
      try {
        const session = JSON.parse(studentActiveRaw);
        setStudentSession(session);
        setRole('student');
      } catch (e) {
        console.error('Failed to parse cached student session:', e);
        localStorage.removeItem('active_student');
      }
    }

    const handleOnline = () => {
      console.log('Network connection restored. Syncing offline results...');
      syncOfflineResults();
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      syncOfflineResults();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleAdminLoginSuccess = () => {
    setRole('admin');
  };

  const handleStudentLoginSuccess = (
    userRole: 'student' | 'admin', 
    session: { name: string; rollNumber: string } | null
  ) => {
    setRole(userRole);
    setStudentSession(session);
    setExamState('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('active_role');
    localStorage.removeItem('active_student');
    setRole(null);
    setStudentSession(null);
    setExamState('dashboard');
    // If on /admin route, stay there after logout
    if (!isAdminRoute) {
      window.location.href = '/';
    }
  };

  // ─── ADMIN ROUTE (/admin) ───────────────────────────────────────────────────
  if (isAdminRoute) {
    if (role === 'admin') {
      return <AdminDashboard onLogout={handleLogout} />;
    }
    return <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />;
  }

  // ─── STUDENT ROUTE (/) ─────────────────────────────────────────────────────
  // 1. Auth (not logged in)
  if (!role) {
    return <Auth onLoginSuccess={handleStudentLoginSuccess} />;
  }

  // 2. Student workspace
  switch (examState) {
    case 'dashboard':
      return (
        <StudentDashboard 
          student={studentSession!} 
          onStartExam={(exam, draft) => {
            setActiveExam(exam);
            if (draft) {
              setActiveDraft(draft);
              setExamState('exam');
            } else {
              setActiveDraft(null);
              setExamState('verification');
            }
          }} 
          onLogout={handleLogout} 
        />
      );

    case 'verification':
      return (
        <VerificationScreen 
          exam={activeExam!} 
          onVerifySuccess={() => setExamState('exam')} 
          onCancel={() => {
            setActiveExam(null);
            setExamState('dashboard');
          }} 
        />
      );

    case 'exam':
      return (
        <ExamEngine 
          exam={activeExam!} 
          student={studentSession!} 
          activeDraft={activeDraft}
          onFinished={(res, uploaded) => {
            setActiveResult(res);
            setUploadSuccess(uploaded);
            setActiveDraft(null);
            setExamState('outcome');
          }} 
        />
      );

    case 'outcome':
      return (
        <OutcomeScreen 
          result={activeResult!} 
          uploadSuccess={uploadSuccess} 
          onDone={() => {
            setActiveExam(null);
            setActiveResult(null);
            handleLogout();
          }} 
        />
      );

    default:
      return (
        <StudentDashboard 
          student={studentSession!} 
          onStartExam={(exam) => {
            setActiveExam(exam);
            setExamState('verification');
          }} 
          onLogout={handleLogout} 
        />
      );
  }
}
