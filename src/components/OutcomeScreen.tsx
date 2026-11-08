import type { Result } from '../utils/db';
import { CloudCheck, CloudOff, ShieldCheck, ArrowLeft, Clock } from 'lucide-react';
import '../styles/outcome.css';

interface OutcomeScreenProps {
  result: Result;
  uploadSuccess: boolean;
  onDone: () => void;
}

export default function OutcomeScreen({ result, uploadSuccess, onDone }: OutcomeScreenProps) {
  return (
    <div className="ui-shell oc-shell">
      <div className="oc-card ui-card ui-page">
        <div className="oc-check" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <circle cx="36" cy="36" r="32" className="oc-check__ring" />
            <path d="M23 37l9 9 17-20" className="oc-check__tick" />
          </svg>
        </div>

        <h1 className="oc-title">Exam completed successfully</h1>
        <p className="oc-sub">
          Your responses for <strong>{result.examName}</strong> have been secured.
        </p>

        {result.timeTaken && (
          <div className="oc-meta">
            <span className="ui-chip"><Clock size={14} strokeWidth={1.75} /> Time taken <span className="ui-mono">{result.timeTaken}</span></span>
          </div>
        )}

        <div className={`oc-sync ui-badge ${uploadSuccess ? 'ui-badge--success' : 'ui-badge--warning'}`} role="status" aria-live="polite">
          {uploadSuccess ? <CloudCheck size={16} strokeWidth={1.75} /> : <CloudOff size={16} strokeWidth={1.75} />}
          {uploadSuccess ? 'Responses synced to database logs.' : 'Responses saved locally. Auto-sync queue active.'}
        </div>

        <div className="oc-note">
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          <p>
            <strong>Note:</strong> To maintain evaluation integrity, detailed marks and correct options are restricted. Your responses are logged securely and are available only in the teacher's dashboard.
          </p>
        </div>

        <button className="ui-btn ui-btn--primary oc-done" onClick={onDone}>
          <ArrowLeft size={18} strokeWidth={1.75} /> Back to Dashboard
        </button>
      </div>
    </div>
  );
}
