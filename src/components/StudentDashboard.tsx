import { useEffect, useState } from 'react';
import { getExams, getResults, checkActiveDraft } from '../utils/db';
import type { Exam, Result } from '../utils/db';
import { showToast } from '../utils/notifications';

interface StudentDashboardProps {
  student: { name: string; rollNumber: string };
  onStartExam: (exam: Exam, draft: Result | null) => void;
  onLogout: () => void;
}

export default function StudentDashboard({ student, onStartExam, onLogout }: StudentDashboardProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [studentResults, setStudentResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingDraft, setCheckingDraft] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const fetchedExams = await getExams();
        const fetchedResults = await getResults();
        setExams(fetchedExams);

        // Filter result records for this specific student
        const personalResults = fetchedResults.filter(r => r.rollNumber === student.rollNumber);
        setStudentResults(personalResults);
      } catch (err) {
        console.error('Failed to load student dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [student.rollNumber]);

  const handleStartExamClick = async (exam: Exam) => {
    setCheckingDraft(true);
    try {
      const draft = await checkActiveDraft(student.rollNumber, exam.id);
      if (draft) {
        showToast(`Resuming your saved attempt for "${exam.title}" started at ${draft.startTime}.`, 'info');
        onStartExam(exam, draft);
      } else {
        onStartExam(exam, null);
      }
    } catch (e) {
      console.warn('Resumption draft query failed, starting fresh:', e);
      onStartExam(exam, null);
    } finally {
      setCheckingDraft(false);
    }
  };

  const now = new Date();
  const availableExams = exams.filter(e => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    return now >= start && now <= end;
  });

  if (loading || checkingDraft) {
    return (
      <div className="student-dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loading-state">
          {checkingDraft ? 'Scanning active drafts in database...' : 'Syncing dashboard logs...'}
        </div>
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      {/* Profile Header */}
      <div className="dashboard-header animate-fade-in">
        <div className="profile-info">
          <div className="avatar">{student.name.charAt(0).toUpperCase()}</div>
          <div>
            <h2>Welcome, {student.name}</h2>
            <p>Roll Number: <span className="highlight">{student.rollNumber}</span></p>
          </div>
        </div>
        <button className="btn btn-secondary logout-btn" onClick={onLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Logout
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Available Exams */}
        <div className="dashboard-card animate-slide-up">
          <div className="card-header">
            <h3>

              Available Examinations
            </h3>
          </div>
          <div className="exams-list">
            {availableExams.length === 0 ? (
              <div className="empty-state">
                <p>No exams are currently active. Please check back later.</p>
              </div>
            ) : (
              availableExams.map(exam => {
                const alreadyTaken = studentResults.some(r => r.examId === exam.id && r.isSubmitted);
                return (
                  <div key={exam.id} className="exam-item">
                    <div className="exam-info">
                      <h4>{exam.title}</h4>
                      <p className="meta">
                        <span>Duration: {exam.duration} mins</span> |
                        <span>Questions: {exam.questions.length}</span> |
                        <span>Total: {exam.questions.reduce((s: number, q: any) => s + (q.marks || 0), 0)} marks</span> |
                        <span>Pass: {exam.passingMarks} marks</span>
                      </p>
                    </div>
                    <div className="exam-action">
                      {alreadyTaken ? (
                        <span className="badge badge-success">Completed</span>
                      ) : (
                        <button className="btn btn-primary" onClick={() => handleStartExamClick(exam)}>
                          Start Exam
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>


      </div>
    </div>
  );
}
