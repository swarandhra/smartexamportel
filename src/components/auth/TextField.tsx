import type { LucideIcon } from 'lucide-react';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  icon?: LucideIcon;
  mono?: boolean;
  error?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  hint?: string;
}

export default function TextField({ id, label, value, onChange, onBlur, placeholder, icon: Icon, mono, error, autoComplete, autoFocus, hint }: Props) {
  return (
    <div className="au-field">
      <label className="au-label" htmlFor={id}>{label}</label>
      <div className="au-input-wrap">
        {Icon && <Icon size={18} strokeWidth={1.75} className="au-lead-icon" aria-hidden="true" />}
        <input id={id} type="text" className={`au-input ${Icon ? 'has-icon' : ''} ${mono ? 'mono' : ''} ${error ? 'is-invalid' : ''}`} value={value} placeholder={placeholder}
          autoComplete={autoComplete} autoFocus={autoFocus} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={e => onChange(e.target.value)} onBlur={onBlur} />
      </div>
      {error ? <p id={`${id}-err`} className="au-error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="au-hint">{hint}</p> : null}
    </div>
  );
}
