import { ShieldAlert, Maximize } from 'lucide-react';
import '../styles/warning.css';

interface WarningOverlayProps {
  show: boolean;
  title: string;
  message: string;
  count: number;
  maxCount?: number;
  onResume: () => void;
}

export default function WarningOverlay({ show, title, message, count, maxCount = 8, onResume }: WarningOverlayProps) {
  if (!show) return null;

  return (
    <div className="security-warning-overlay wo-overlay" role="alertdialog" aria-modal="true" aria-labelledby="wo-title" aria-describedby="wo-msg">
      <div className="wo-card">
        <div className="wo-icon"><ShieldAlert size={32} strokeWidth={1.75} aria-hidden="true" /></div>
        <h3 id="wo-title" className="wo-title">{title}</h3>
        <p id="wo-msg" className="wo-msg">{message}</p>

        <div className="wo-meter" role="img" aria-label={`Warning ${count} of ${maxCount}`}>
          {Array.from({ length: maxCount }, (_, i) => (
            <span key={i} className={i < count ? 'wo-seg wo-seg--on' : 'wo-seg'} />
          ))}
        </div>
        <div className="wo-count">Warning <strong>{count}</strong> of {maxCount}</div>
        <div className="wo-hint">
          {maxCount - count} more violation{maxCount - count === 1 ? '' : 's'} will auto-submit your exam.
        </div>

        <button className="wo-btn" onClick={onResume}>
          <Maximize size={18} strokeWidth={1.75} /> Return to exam (full screen)
        </button>
      </div>
    </div>
  );
}
