import type { Result } from '../utils/db';

interface OutcomeScreenProps {
  result: Result;
  uploadSuccess: boolean;
  onDone: () => void;
}

export default function OutcomeScreen({ result, uploadSuccess, onDone }: OutcomeScreenProps) {
  return (
    <div className="result-screen animate-fade-in">
      <div className="outcome-card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
        <div className="check-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        
        <h2 style={{ textAlign: 'center', color: 'var(--dark-blue)', marginBottom: '8px' }}>Exam Completed Successfully</h2>
        <p className="subtitle" style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Your responses for <strong>{result.examName}</strong> have been secured.
        </p>
        
        <div className={`status-banner ${uploadSuccess ? 'status-synced' : 'status-pending'}`} style={{ marginBottom: '24px' }}>
          {uploadSuccess ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Responses synced to database logs.
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Responses saved locally. Auto-sync queue active.
            </>
          )}
        </div>

        <div className="result-hidden-notice" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5', marginBottom: '24px' }}>
          <p style={{ margin: 0 }}>
            <strong>Note:</strong> To maintain evaluation integrity, detailed marks and correct options are restricted. Your responses are logged securely and are available only in the teacher's dashboard.
          </p>
        </div>

        <div className="result-actions" style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onDone} style={{ width: '100%' }}>
            Return to Registration Portal
          </button>
        </div>
      </div>
    </div>
  );
}
