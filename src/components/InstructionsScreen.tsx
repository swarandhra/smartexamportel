import type { Exam } from '../utils/db';

interface InstructionsScreenProps {
  exam: Exam;
  onProceed: () => void;
  onCancel: () => void;
}

export default function InstructionsScreen({ exam, onProceed, onCancel }: InstructionsScreenProps) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.07) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.05) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(139, 92, 246, 0.06) 0px, transparent 50%)',
      padding: '40px 20px',
      fontFamily: 'var(--font)'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '6px 16px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.05em',
            marginBottom: '20px',
            border: '1px solid var(--primary-border)'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {exam.title.toUpperCase()}
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: '32px', color: 'var(--dark-blue)', fontWeight: '800' }}>
            Assessment Guidelines
          </h1>
          <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '16px' }}>
            Please review the instructions and exam structure before beginning.
          </p>
        </div>

        {/* Exam Structure Section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)', fontWeight: '700' }}>
              Exam Structure & Marks Division
            </h2>
          </div>

          {(() => {
            const mcqs = exam.questions.filter(q => !q.type.includes('coding') && !q.type.includes('practical'));
            const coding = exam.questions.filter(q => q.type === 'coding');
            const practical = exam.questions.filter(q => q.type.startsWith('practical'));

            const mcqMarks = mcqs.reduce((s, q) => s + (q.marks || 1), 0);
            const codingMarks = coding.reduce((s, q) => s + (q.marks || 1), 0);
            const practicalMarks = practical.reduce((s, q) => s + (q.marks || 1), 0);
            const totalMarks = mcqMarks + codingMarks + practicalMarks;

            return (
              <>
                {/* Purple Summary Banner */}
                <div style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--navy))',
                  borderRadius: '16px',
                  padding: '24px 32px',
                  color: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                  boxShadow: '0 10px 25px rgba(99, 102, 241, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px', height: '48px',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="8" r="7" />
                        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9, letterSpacing: '0.05em', marginBottom: '4px' }}>
                        TOTAL ASSESSMENT
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800' }}>
                        {totalMarks} Marks • {exam.duration} Minutes
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', margin: '0 auto 6px' }}>{mcqs.length}</div>
                      <div style={{ fontSize: '12px', fontWeight: '500' }}>MCQs</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', margin: '0 auto 6px' }}>{coding.length}</div>
                      <div style={{ fontSize: '12px', fontWeight: '500' }}>Coding</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', margin: '0 auto 6px' }}>{practical.length}</div>
                      <div style={{ fontSize: '12px', fontWeight: '500' }}>Practical</div>
                    </div>
                  </div>
                </div>

                {/* Details Columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  
                  {/* Column 1: MCQs */}
                  <div style={{ background: 'var(--bg-input)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: 'var(--primary)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>1</div>
                        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: '700' }}>MCQS</h3>
                      </div>
                      <div style={{ background: 'var(--primary)', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px' }}>{mcqMarks} Marks</div>
                    </div>
                    <p style={{ margin: '0 0 20px', fontSize: '12px', color: 'var(--navy)', fontWeight: '600' }}>
                      Standard MCQs • Subjective • Fill in the blanks
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                          <span>📝</span> All Questions
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>Q1-Q{mcqs.length}</div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: CODING */}
                  <div style={{ background: 'rgba(168, 85, 247, 0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: '#a855f7', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>2</div>
                        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: '700' }}>CODING</h3>
                      </div>
                      <div style={{ background: '#a855f7', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px' }}>{codingMarks} Marks</div>
                    </div>
                    <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#c084fc', fontWeight: '600' }}>
                      Algorithms • Data Structures • Logic
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {coding.map((item, i) => (
                        <div key={i} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.15)', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>Problem {i+1}</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 8px', borderRadius: '100px' }}>{item.marks}M</div>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.questionText}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Built-in code editor</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 3: PRACTICAL */}
                  <div style={{ background: 'rgba(249, 115, 22, 0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: '#f97316', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>3</div>
                        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: '700' }}>PRACTICAL</h3>
                      </div>
                      <div style={{ background: '#f97316', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px' }}>{practicalMarks} Marks</div>
                    </div>
                    <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#f97316', fontWeight: '600' }}>
                      Web Dev • Object Oriented • System Design
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {practical.map((item, i) => (
                        <div key={i} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(249, 115, 22, 0.15)', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>Task {i+1}</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--navy)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '100px' }}>{item.type.replace('practical-', '').toUpperCase()} - {item.marks}M</div>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.questionText}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IDE environment</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </>
            );
          })()}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '32px' }}>
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ padding: '14px 28px', borderRadius: '12px', minWidth: '140px' }}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary"
            onClick={onProceed}
            style={{ padding: '14px 40px', borderRadius: '12px', minWidth: '240px', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)' }}
          >
            Proceed to Verification
          </button>
        </div>
      </div>
    </div>
  );
}
