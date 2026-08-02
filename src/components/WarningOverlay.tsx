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
    <div className="security-warning-overlay">
      <div className="warning-card animate-scale-up">
        <div className="warning-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="warning-count-display">
          Violation <span>{count}</span> of {maxCount}
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
          {maxCount - count} more violation{maxCount - count === 1 ? '' : 's'} will auto-submit your exam.
        </div>
        <button className="btn btn-danger" onClick={onResume}>
          Resume Exam (Re-enter Fullscreen)
        </button>
      </div>
    </div>
  );
}
