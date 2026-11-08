import React, { useRef, useState } from 'react';
import { authenticateStudent, registerStudent } from '../utils/db';
import { showToast } from '../utils/notifications';
import { ShieldCheck, Video, Lock, Zap, BarChart3, LogIn, UserPlus, Loader2, User, GraduationCap, IdCard } from 'lucide-react';
import PasswordField from './auth/PasswordField';
import TextField from './auth/TextField';
import { Aurora, useGlassSheen } from './auth/Aurora';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../utils/theme';
import '../styles/auth.css';

interface AuthProps {
  onLoginSuccess: (role: 'student' | 'admin', session: { name: string; rollNumber: string } | null) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [theme, toggleTheme] = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  useGlassSheen(cardRef);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched(t => ({ ...t, [k]: true }));

  // Login fields
  const [loginRoll, setLoginRoll] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regRoll, setRegRoll] = useState('');
  const [regBranch, setRegBranch] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const roll = loginRoll.trim();
    const pass = loginPass.trim();
    if (!roll || !pass) {
      showToast('Please enter your Roll Number and Password.', 'warning');
      return;
    }
    setLoading(true);
    const res = await authenticateStudent(roll, pass);
    setLoading(false);
    if (res.success && res.student) {
      localStorage.setItem('active_student', JSON.stringify(res.student));
      localStorage.removeItem('active_role');
      onLoginSuccess('student', res.student);
    } else {
      showToast(res.error || 'Authentication failed. Check your credentials.', 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = regName.trim();
    const roll = regRoll.trim();
    const branch = regBranch.trim();
    const pass = regPass.trim();
    const confirm = regConfirmPass.trim();

    if (!name || !roll || !branch || !pass || !confirm) {
      showToast('Please fill out all fields.', 'warning');
      return;
    }
    if (pass !== confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (pass.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    setLoading(true);
    const res = await registerStudent(roll, name, pass, branch);
    setLoading(false);

    if (res.success) {
      showToast('Registration successful! You can now sign in.', 'success');
      setMode('login');
      setRegName(''); setRegRoll(''); setRegBranch(''); setRegPass(''); setRegConfirmPass('');
    } else {
      showToast(res.error || 'Registration failed. Please try again.', 'error');
    }
  };

  const features = [
    { icon: Video, text: 'Live camera proctoring with face detection' },
    { icon: Lock, text: 'Strict security with violation tracking' },
    { icon: Zap, text: 'Instant automated scoring & results' },
    { icon: BarChart3, text: 'Admin analytics & performance insights' },
  ];
  const req = (k: string, v: string) => (touched[k] && !v.trim() ? 'Required' : undefined);
  const passErr = touched.regPass && regPass.trim() && regPass.trim().length < 6 ? 'Password must be at least 6 characters.' : req('regPass', regPass);
  const confirmErr = touched.regConfirm && regConfirmPass.trim() && regConfirmPass.trim() !== regPass.trim() ? 'Passwords do not match.' : req('regConfirm', regConfirmPass);

  return (
    <div className="au">
      <Aurora />
      <div className="au-theme"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
      <div className="au-hero">
        <div className="au-hero__inner">
          <div className="au-brand">
            <div className="au-logo"><ShieldCheck size={26} strokeWidth={1.75} /></div>
            <div><b>Smart Exam Portal</b><span>AI-Proctored Assessment</span></div>
          </div>
          <h2 className="au-title">Secure.<br /><em>Intelligent.</em><br />Fair.</h2>
          <p className="au-sub">A next-generation online examination platform with AI-powered proctoring, real-time monitoring, and instant results.</p>
          <ul className="au-features">
            {features.map(f => (
              <li key={f.text}><span className="au-chip"><f.icon size={18} strokeWidth={1.75} /></span>{f.text}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="au-compact">
        <div className="au-logo"><ShieldCheck size={22} strokeWidth={1.75} /></div>
        <div><b>Smart Exam Portal</b><span>Secure. Intelligent. Fair.</span></div>
      </div>

      <div className="au-panel">
        <div className="au-glass" ref={cardRef}>
          <h1 className="au-h1">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
          <p className="au-lead">
            {mode === 'login'
              ? 'Sign in to access your assigned examinations.'
              : 'Register once to access all your assigned exams.'}
          </p>

          <div className="au-tabs" role="tablist" aria-label="Sign in or register" data-mode={mode}>
            <span className="au-pill" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={mode === 'login'} className="au-tab" onClick={() => setMode('login')}>Sign In</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className="au-tab" onClick={() => setMode('register')}>Register</button>
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="au-form" key="login">
              <TextField id="login-roll" label="Roll Number / Student ID" placeholder="e.g. 23a91a0501" icon={IdCard} mono value={loginRoll}
                onChange={setLoginRoll} onBlur={() => touch('loginRoll')} autoComplete="username" autoFocus
                error={req('loginRoll', loginRoll) && 'Please enter your Roll Number.'} />
              <PasswordField id="login-pass" label="Access Password" placeholder="Your password" value={loginPass} onChange={setLoginPass}
                onBlur={() => touch('loginPass')} autoComplete="current-password" error={req('loginPass', loginPass) && 'Please enter your Password.'} />
              <button type="submit" className="ui-btn ui-btn--primary au-submit" disabled={loading}>
                {loading ? <Loader2 size={18} className="ui-spinner" /> : <LogIn size={18} strokeWidth={1.75} />}
                <span>{loading ? 'Signing in…' : 'Sign in to exam portal'}</span>
              </button>
              <p className="au-switch">Don't have an account? <button type="button" className="au-link" onClick={() => setMode('register')}>Register here</button></p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="au-form" key="register">
              <div className="au-row">
                <TextField id="reg-name" label="Full Name" placeholder="Your full name" icon={User} value={regName} onChange={setRegName}
                  onBlur={() => touch('regName')} autoComplete="name" autoFocus error={req('regName', regName)} />
                <TextField id="reg-roll" label="Roll Number" placeholder="23a91a0501" icon={IdCard} mono value={regRoll} onChange={setRegRoll}
                  onBlur={() => touch('regRoll')} error={req('regRoll', regRoll)} />
              </div>
              <TextField id="reg-branch" label="College Branch / Department" placeholder="e.g. cse, ece, it" icon={GraduationCap} mono value={regBranch}
                onChange={setRegBranch} onBlur={() => touch('regBranch')} error={req('regBranch', regBranch)}
                hint="Type your branch abbreviation manually (e.g. CSE, ECE, IT)" />
              <PasswordField id="reg-pass" label="Create Password" placeholder="Min. 6 characters" value={regPass} onChange={setRegPass}
                onBlur={() => touch('regPass')} autoComplete="new-password" error={passErr} />
              <PasswordField id="reg-confirm" label="Confirm Password" placeholder="Re-enter password" value={regConfirmPass} onChange={setRegConfirmPass}
                onBlur={() => touch('regConfirm')} autoComplete="new-password" error={confirmErr} />
              <button type="submit" className="ui-btn ui-btn--primary au-submit" disabled={loading}>
                {loading ? <Loader2 size={18} className="ui-spinner" /> : <UserPlus size={18} strokeWidth={1.75} />}
                <span>{loading ? 'Registering…' : 'Create student account'}</span>
              </button>
              <p className="au-switch">Already registered? <button type="button" className="au-link" onClick={() => setMode('login')}>Sign in here</button></p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
