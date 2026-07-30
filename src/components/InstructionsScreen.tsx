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
      background: '#f8fafc',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        background: '#fff',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.05)'
      }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#eff6ff',
            color: '#3b82f6',
            padding: '6px 16px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.05em',
            marginBottom: '20px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            TECHWING AI ASSESSMENT
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: '32px', color: '#0f172a', fontWeight: '800' }}>
            Assessment Guidelines
          </h1>
          <p style={{ margin: '0', color: '#64748b', fontSize: '16px' }}>
            Please review the instructions and exam structure before beginning.
          </p>
        </div>

        {/* Exam Structure Section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '700' }}>
              Exam Structure & Marks Division
            </h2>
          </div>

          {/* Blue Summary Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
            borderRadius: '16px',
            padding: '24px 32px',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            boxShadow: '0 10px 25px rgba(37, 99, 235, 0.2)'
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
                  100 Marks • {exam.duration} Minutes
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', margin: '0 auto 6px' }}>50</div>
                <div style={{ fontSize: '12px', fontWeight: '500' }}>MCQs</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', margin: '0 auto 6px' }}>2</div>
                <div style={{ fontSize: '12px', fontWeight: '500' }}>Coding</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', margin: '0 auto 6px' }}>2</div>
                <div style={{ fontSize: '12px', fontWeight: '500' }}>Practical</div>
              </div>
            </div>
          </div>

          {/* Details Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            
            {/* Column 1: MCQs */}
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#3b82f6', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>1</div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: '700' }}>MCQS</h3>
                </div>
                <div style={{ background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px' }}>50 Marks</div>
              </div>
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
                1 mark per question • 60 sec per question
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { icon: '📐', name: 'Aptitude & Verbal', q: 'Q1-Q8' },
                  { icon: '☕', name: 'Java Programming', q: 'Q9-Q16' },
                  { icon: '🌐', name: 'HTML & DSA', q: 'Q17-Q25' },
                  { icon: '💻', name: 'Java & HTML', q: 'Q26-Q45' },
                  { icon: '🧠', name: 'Reasoning & Verbal', q: 'Q46-Q50' }
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                      <span>{item.icon}</span> {item.name}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{item.q}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: CODING */}
            <div style={{ background: '#faf5ff', borderRadius: '16px', padding: '24px', border: '1px solid #f3e8ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#a855f7', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>2</div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: '700' }}>CODING</h3>
                </div>
                <div style={{ background: '#a855f7', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px' }}>30 Marks</div>
              </div>
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#a855f7', fontWeight: '600' }}>
                15 marks each • Built-in code editor
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { id: 'Problem 1', title: 'Move All Zeroes to End', diff: 'Easy - 15M', tags: 'Arrays • Two Pointer • Loops' },
                  { id: 'Problem 2', title: 'Find Second Largest Element', diff: 'Med - 15M', tags: 'Arrays • Variables • Logic' }
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #f3e8ff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{item.id}</div>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: item.diff.includes('Easy') ? '#22c55e' : '#f59e0b', background: item.diff.includes('Easy') ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '100px' }}>{item.diff}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', fontWeight: '500', marginBottom: '8px' }}>{item.title}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.tags}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: PRACTICAL */}
            <div style={{ background: '#fff7ed', borderRadius: '16px', padding: '24px', border: '1px solid #ffedd5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#f97316', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>3</div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: '700' }}>PRACTICAL</h3>
                </div>
                <div style={{ background: '#f97316', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px' }}>20 Marks</div>
              </div>
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#ea580c', fontWeight: '600' }}>
                10 marks each • 30 min per task
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { id: 'Task 1', title: 'Student Registration Form', diff: 'HTML - 10M', tags: '10 fields • Validation • CSS Styling' },
                  { id: 'Task 2', title: 'Student Marks Calculator', diff: 'Java - 10M', tags: '3 Methods • Scanner • Pass/Fail' }
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #ffedd5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{item.id}</div>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '100px' }}>{item.diff}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', fontWeight: '500', marginBottom: '8px' }}>{item.title}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.tags}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '40px', borderTop: '1px solid #f1f5f9', paddingTop: '32px' }}>
          <button 
            onClick={onCancel}
            style={{ padding: '14px 28px', borderRadius: '12px', border: '2px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={onProceed}
            style={{ padding: '14px 40px', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
          >
            Proceed to Verification
          </button>
        </div>

      </div>
    </div>
  );
}
