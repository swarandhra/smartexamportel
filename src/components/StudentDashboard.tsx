import { useEffect, useState } from 'react';
import { getExams, getResults, checkActiveDraft } from '../utils/db';
import type { Exam, Result } from '../utils/db';
import { showToast } from '../utils/notifications';
import { Clock, HelpCircle, Target, Trophy, LogOut, CheckCircle2, Play, Inbox, Loader2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../utils/theme';
import '../styles/student.css';

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
  const [theme, toggleTheme] = useTheme();

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

  const submittedResults = studentResults.filter(r => r.isSubmitted);

  if (loading) {
    return (
      <div className="ui-shell" data-theme={theme}>
        <div className="ui-container" aria-busy="true" aria-label="Loading dashboard">
          <div className="ui-skeleton" style={{ height: 88, marginBottom: 24, borderRadius: 16 }} />
          <div className="ui-skeleton" style={{ height: 120, marginBottom: 16, borderRadius: 16 }} />
          <div className="ui-skeleton" style={{ height: 120, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="ui-shell" data-theme={theme}>
      <div className="ui-container ui-page">
        <header className="sd-header ui-card">
          <div className="sd-profile">
            <div className="sd-avatar" aria-hidden="true">{student.name.charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="sd-greeting">Welcome, {student.name}</h1>
              <p className="sd-roll">Roll number <span className="ui-mono">{student.rollNumber}</span></p>
            </div>
          </div>
          <div className="sd-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button className="ui-btn ui-btn--secondary" onClick={onLogout}>
              <LogOut size={18} strokeWidth={1.75} /> Logout
            </button>
          </div>
        </header>

        <section aria-labelledby="sd-exams-title" className="sd-section">
          <h2 id="sd-exams-title" className="sd-section-title">Available examinations</h2>
          {availableExams.length === 0 ? (
            <div className="sd-empty ui-card">
              <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                <rect x="18" y="14" width="60" height="68" rx="10" fill="var(--c-primary-tint)" stroke="var(--c-primary-text)" strokeWidth="2" />
                <path d="M32 36h32M32 48h32M32 60h18" stroke="var(--c-primary-text)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <p className="sd-empty-title"><Inbox size={18} strokeWidth={1.75} aria-hidden="true" /> No exams are open right now</p>
              <p className="sd-empty-sub">No exams are currently active. Please check back later.</p>
            </div>
          ) : (
            <div className="sd-exam-list ui-stagger">
              {availableExams.map(exam => {
                const alreadyTaken = studentResults.some(r => r.examId === exam.id && r.isSubmitted);
                const totalMarks = exam.questions.reduce((s: number, q: any) => s + (q.marks || 0), 0);
                return (
                  <article key={exam.id} className="sd-exam ui-card">
                    <div className="sd-exam-main">
                      <div className="sd-exam-head">
                        <h3>{exam.title}</h3>
                        {alreadyTaken
                          ? <span className="ui-badge ui-badge--success"><CheckCircle2 size={14} strokeWidth={1.75} /> Completed</span>
                          : <span className="ui-badge ui-badge--primary">Available</span>}
                      </div>
                      <div className="sd-chips">
                        <span className="ui-chip"><Clock size={14} strokeWidth={1.75} /> {exam.duration} mins</span>
                        <span className="ui-chip"><HelpCircle size={14} strokeWidth={1.75} /> {exam.questions.length} questions</span>
                        <span className="ui-chip"><Trophy size={14} strokeWidth={1.75} /> {totalMarks} marks</span>
                        <span className="ui-chip"><Target size={14} strokeWidth={1.75} /> Pass {exam.passingMarks}</span>
                      </div>
                    </div>
                    {!alreadyTaken && (
                      <button className="ui-btn ui-btn--primary sd-start" onClick={() => handleStartExamClick(exam)} disabled={checkingDraft}>
                        {checkingDraft ? <Loader2 size={18} className="ui-spinner" /> : <Play size={18} strokeWidth={1.75} />}
                        <span>Start exam</span>
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {submittedResults.length > 0 && (
          <section aria-labelledby="sd-results-title" className="sd-section">
            <h2 id="sd-results-title" className="sd-section-title">Your submissions</h2>
            <div className="sd-exam-list ui-stagger">
              {submittedResults.map(r => {
                const reveal = exams.find(e => e.id === r.examId)?.showResultToStudent;
                const pct = Math.max(0, Math.min(100, Math.round(r.percentage || 0)));
                const circ = 2 * Math.PI * 26;
                return (
                  <article key={r.id} className="sd-exam ui-card">
                    {reveal && (
                      <div className={`ui-ring ${r.status === 'Pass' ? 'ui-ring--pass' : 'ui-ring--fail'}`} style={{ width: 64, height: 64 }}>
                        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                          <circle className="ui-ring__track" cx="32" cy="32" r="26" fill="none" strokeWidth="6" />
                          <circle className="ui-ring__value" cx="32" cy="32" r="26" fill="none" strokeWidth="6"
                            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
                        </svg>
                        <span className="ui-ring__label" style={{ fontSize: 13 }}>{pct}%</span>
                      </div>
                    )}
                    <div className="sd-exam-main">
                      <div className="sd-exam-head">
                        <h3>{r.examName}</h3>
                        {reveal
                          ? <span className={`ui-badge ${r.status === 'Pass' ? 'ui-badge--success' : 'ui-badge--danger'}`}>{r.status === 'Pass' ? 'Passed' : 'Not passed'}</span>
                          : <span className="ui-badge ui-badge--info">Submitted</span>}
                      </div>
                      <div className="sd-chips">
                        <span className="ui-chip">{r.date}</span>
                        {reveal && <span className="ui-chip ui-mono">{r.marksObtained} / {r.totalMarks}</span>}
                        {!reveal && <span className="ui-chip">Results are released by your teacher</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="sd-footer">Smart Exam Portal · Venky's Platforms</footer>
      </div>
    </div>
  );
}
