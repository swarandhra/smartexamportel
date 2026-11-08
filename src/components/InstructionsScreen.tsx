import type { Exam } from '../utils/db';
import { Layers, ListChecks, Code2, Monitor, Award, FileText } from 'lucide-react';
import Stepper from './Stepper';
import { useTheme } from '../utils/theme';
import '../styles/setup.css';

interface InstructionsScreenProps {
  exam: Exam;
  onProceed: () => void;
  onCancel: () => void;
}

export default function InstructionsScreen({ exam, onProceed, onCancel }: InstructionsScreenProps) {
  const [theme] = useTheme();
  const mcqs = exam.questions.filter(q => !q.type.includes('coding') && !q.type.includes('practical'));
  const coding = exam.questions.filter(q => q.type === 'coding');
  const practical = exam.questions.filter(q => q.type.startsWith('practical'));

  const mcqMarks = mcqs.reduce((s, q) => s + (q.marks || 1), 0);
  const codingMarks = coding.reduce((s, q) => s + (q.marks || 1), 0);
  const practicalMarks = practical.reduce((s, q) => s + (q.marks || 1), 0);
  const totalMarks = mcqMarks + codingMarks + practicalMarks;
  const pct = (m: number) => (totalMarks ? (m / totalMarks) * 100 : 0);

  return (
    <div className="ui-shell" data-theme={theme}>
      <div className="su-wrap ui-page">
        <Stepper current={0} />
        <div className="su-head">
          <span className="ui-badge ui-badge--primary"><Layers size={14} strokeWidth={1.75} /> {exam.title}</span>
          <h1>Assessment guidelines</h1>
          <p>Please review the instructions and exam structure before beginning.</p>
        </div>

        <section className="su-summary ui-card" aria-label="Exam summary">
          <div className="su-summary-main">
            <Award size={22} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <div className="su-eyebrow">Total assessment</div>
              <div className="su-total ui-mono">{totalMarks} marks · {exam.duration} minutes</div>
            </div>
          </div>
          <div className="su-bar" role="img" aria-label={`Marks split: MCQs ${mcqMarks}, coding ${codingMarks}, practical ${practicalMarks}`}>
            <span className="su-bar__seg su-bar__seg--mcq" style={{ width: pct(mcqMarks) + '%' }} />
            <span className="su-bar__seg su-bar__seg--code" style={{ width: pct(codingMarks) + '%' }} />
            <span className="su-bar__seg su-bar__seg--prac" style={{ width: pct(practicalMarks) + '%' }} />
          </div>
        </section>

        <div className="su-cols ui-stagger">
          <section className="su-col ui-card">
            <div className="su-col-head">
              <h2><ListChecks size={18} strokeWidth={1.75} /> MCQs</h2>
              <span className="ui-badge ui-badge--info">{mcqMarks} marks</span>
            </div>
            <p className="su-col-sub">Standard MCQs · Subjective · Fill in the blanks</p>
            <div className="su-item"><FileText size={16} strokeWidth={1.75} /> <span>All questions</span><b className="ui-mono">Q1–Q{mcqs.length}</b></div>
          </section>

          <section className="su-col ui-card">
            <div className="su-col-head">
              <h2><Code2 size={18} strokeWidth={1.75} /> Coding</h2>
              <span className="ui-badge ui-badge--primary">{codingMarks} marks</span>
            </div>
            <p className="su-col-sub">Algorithms · Data structures · Logic</p>
            {coding.map((item, i) => (
              <div key={i} className="su-task">
                <div className="su-task-head"><b>Problem {i + 1}</b><span className="ui-badge ui-badge--success">{item.marks}M</span></div>
                <p>{item.questionText}</p>
                <small>Built-in code editor</small>
              </div>
            ))}
          </section>

          <section className="su-col ui-card">
            <div className="su-col-head">
              <h2><Monitor size={18} strokeWidth={1.75} /> Practical</h2>
              <span className="ui-badge ui-badge--warning">{practicalMarks} marks</span>
            </div>
            <p className="su-col-sub">Web dev · Object oriented · System design</p>
            {practical.map((item, i) => (
              <div key={i} className="su-task">
                <div className="su-task-head"><b>Task {i + 1}</b><span className="ui-badge ui-badge--info">{item.type.replace('practical-', '').toUpperCase()} · {item.marks}M</span></div>
                <p>{item.questionText}</p>
                <small>IDE environment</small>
              </div>
            ))}
          </section>
        </div>

        <div className="su-actions">
          <button className="ui-btn ui-btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="ui-btn ui-btn--primary" onClick={onProceed}>Proceed to system check</button>
        </div>
      </div>
    </div>
  );
}
