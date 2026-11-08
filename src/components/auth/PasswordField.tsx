import { useState } from 'react';
import { Eye, EyeOff, Lock, TriangleAlert } from 'lucide-react';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  error?: string;
  invalid?: boolean;
}

export default function PasswordField({ id, label, value, onChange, onBlur, placeholder, autoComplete, autoFocus, error, invalid }: Props) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: React.KeyboardEvent) => setCaps(e.getModifierState('CapsLock'));
  return (
    <div className="au-field">
      <label className="au-label" htmlFor={id}>{label}</label>
      <div className="au-input-wrap">
        <Lock size={18} strokeWidth={1.75} className="au-lead-icon" aria-hidden="true" />
        <input id={id} className={`au-input has-icon has-pass ${error || invalid ? 'is-invalid' : ''}`} type={show ? 'text' : 'password'} value={value} placeholder={placeholder}
          autoComplete={autoComplete} autoFocus={autoFocus} aria-invalid={!!error || invalid} aria-describedby={error ? `${id}-err` : undefined}
          onChange={e => onChange(e.target.value)} onKeyDown={checkCaps} onKeyUp={checkCaps}
          onBlur={() => { setCaps(false); onBlur?.(); }} />
        <button type="button" className="au-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      </div>
      {caps && <p className="au-hint au-hint--warn" role="status"><TriangleAlert size={14} strokeWidth={1.75} /> Caps Lock is on</p>}
      {error && <p id={`${id}-err`} className="au-error" role="alert">{error}</p>}
    </div>
  );
}
