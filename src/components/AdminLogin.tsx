import React, { useRef, useState } from 'react';
import { getSettings } from '../utils/db';
import { showToast } from '../utils/notifications';
import { ShieldCheck, KeyRound, ArrowLeft, Loader2, TriangleAlert, UserCog } from 'lucide-react';
import PasswordField from './auth/PasswordField';
import { Aurora, useGlassSheen } from './auth/Aurora';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../utils/theme';
import '../styles/auth.css';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [theme, toggleTheme] = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  useGlassSheen(cardRef);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pass = password.trim();
    if (!pass) {
      showToast('Please enter the admin password.', 'warning');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const settings = getSettings();
      const envPass = import.meta.env.VITE_ADMIN_PASSWORD || 'Venky@80744';
      if (pass === settings.adminPassword || pass === envPass) {
        localStorage.setItem('active_role', 'admin');
        localStorage.removeItem('active_student');
        onLoginSuccess();
      } else {
        showToast('Invalid administrator password. Access denied.', 'error');
        setShake(true);
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="au au-center">
      <div className="au-theme"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
      <Aurora />
      <div ref={cardRef} className={`au-glass ${shake ? 'au-shake' : ''}`} onAnimationEnd={() => setShake(false)}>
        <div className="au-top">
          <div className="au-logo"><ShieldCheck size={28} strokeWidth={1.75} /></div>
          <span className="ui-badge ui-badge--primary au-badge"><UserCog size={14} strokeWidth={1.75} /> Teacher access</span>
          <h1 className="au-h1">Admin Portal</h1>
          <p className="au-lead" style={{ marginBottom: 0 }}>Teacher &amp; Administrator Access</p>
        </div>

        <div className="au-notice" role="note">
          <TriangleAlert size={16} strokeWidth={1.75} />
          <p>This area is for <strong>authorized staff only</strong>. Unauthorized access attempts are logged.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <PasswordField id="admin-pass" label="Admin Password" placeholder="Enter administrator password" value={password}
            onChange={setPassword} autoComplete="current-password" autoFocus invalid={shake} />
          <button type="submit" className="ui-btn ui-btn--primary au-submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="ui-spinner" /> : <KeyRound size={18} strokeWidth={1.75} />}
            <span>{loading ? 'Verifying…' : 'Access admin panel'}</span>
          </button>
        </form>

        <p className="au-switch">
          <button type="button" className="au-link" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={14} strokeWidth={1.75} style={{ verticalAlign: '-2px' }} /> Back to Student Portal
          </button>
        </p>
      </div>
    </div>
  );
}
