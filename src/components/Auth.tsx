import React, { useState } from 'react';
import { authenticateStudent, registerStudent } from '../utils/db';
import { showToast } from '../utils/notifications';

interface AuthProps {
  onLoginSuccess: (role: 'student' | 'admin', session: { name: string; rollNumber: string } | null) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

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

  return (
    <div className="auth-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .auth-page {
          min-height: 100vh;
          background: radial-gradient(circle at 0% 0%, #0b1528 0%, #020617 60%, #090514 100%);
          display: flex;
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }
        /* Left decorative panel */
        .auth-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          position: relative;
          z-index: 1;
        }
        .auth-left-content {
          max-width: 440px;
        }
        /* Right card panel */
        .auth-right {
          width: 480px;
          min-width: 480px;
          background: rgba(8, 12, 26, 0.7);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-left: 1px solid rgba(59, 130, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 48px;
          overflow-y: auto;
          position: relative;
          z-index: 1;
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.4);
        }
        .auth-right-inner {
          width: 100%;
          max-width: 360px;
        }

        /* Background decoration */
        .auth-orb-1 {
          position: absolute;
          top: -5%;
          left: 10%;
          width: 450px;
          height: 450px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
          filter: blur(40px);
          animation: float-orb-1 20s ease-in-out infinite alternate;
        }
        .auth-orb-2 {
          position: absolute;
          bottom: 5%;
          right: 30%;
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.16) 0%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
          filter: blur(40px);
          animation: float-orb-2 25s ease-in-out infinite alternate;
        }
        .auth-orb-3 {
          position: absolute;
          top: 40%;
          left: 40%;
          width: 280px;
          height: 280px;
          background: radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 75%);
          pointer-events: none;
          border-radius: 50%;
          filter: blur(50px);
        }
        
        @keyframes float-orb-1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, 20px) scale(1.05); }
        }
        @keyframes float-orb-2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-20px, -35px) scale(0.95); }
        }

        .auth-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(99, 102, 241, 0.06) 1px, transparent 1px);
          background-size: 36px 36px;
          pointer-events: none;
        }

        /* Left side content */
        .auth-brand-mark {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 52px;
        }
        .auth-logo-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(6, 182, 212, 0.35);
          position: relative;
        }
        .auth-logo-icon::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.4), rgba(6, 182, 212, 0.4));
          z-index: -1;
          filter: blur(4px);
        }
        .auth-brand-name {
          font-size: 21px;
          font-weight: 850;
          color: #f8fafc;
          letter-spacing: -0.5px;
        }
        .auth-brand-tag {
          font-size: 12px;
          color: #06b6d4;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .auth-hero-title {
          font-size: 48px;
          font-weight: 900;
          color: #f8fafc;
          line-height: 1.15;
          letter-spacing: -1.5px;
          margin: 0 0 20px;
        }
        .auth-hero-title span {
          background: linear-gradient(135deg, #60a5fa, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .auth-hero-sub {
          font-size: 15.5px;
          color: #94a3b8;
          line-height: 1.7;
          margin: 0 0 44px;
        }
        .auth-features {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .auth-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          transition: transform 0.2s ease;
        }
        .auth-feature-item:hover {
          transform: translateX(4px);
        }
        .auth-feature-dot {
          width: 36px;
          height: 36px;
          background: rgba(6, 182, 212, 0.08);
          border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .auth-feature-item:hover .auth-feature-dot {
          background: rgba(6, 182, 212, 0.15);
          border-color: rgba(6, 182, 212, 0.4);
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
        }
        .auth-feature-text {
          font-size: 14.5px;
          color: #cbd5e1;
          font-weight: 500;
        }

        /* Right side form */
        .auth-form-title {
          font-size: 26px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }
        .auth-form-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 32px;
        }
        /* Tab switcher */
        .auth-tabs {
          display: flex;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 28px;
          gap: 4px;
        }
        .auth-tab {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        .auth-tab-active {
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          color: #fff;
          box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);
        }
        .auth-tab-inactive {
          background: transparent;
          color: #64748b;
        }
        .auth-tab-inactive:hover { color: #cbd5e1; }

        /* Form fields */
        .auth-field {
          margin-bottom: 18px;
        }
        .auth-field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 18px;
        }
        .auth-label {
          display: block;
          font-size: 11.5px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 7px;
          text-transform: uppercase;
          letter-spacing: 0.75px;
        }
        .auth-input-wrap {
          position: relative;
        }
        .auth-input {
          width: 100%;
          background: rgba(15, 23, 42, 0.6);
          border: 1.5px solid rgba(51, 65, 85, 0.5);
          border-radius: 12px;
          padding: 12px 44px 12px 14px;
          font-size: 14.5px;
          color: #f8fafc;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
          font-family: inherit;
        }
        .auth-input:not(.auth-input-no-icon) {
          padding-right: 44px;
        }
        .auth-input-no-icon {
          padding-right: 14px;
        }
        .auth-input:focus {
          border-color: #06b6d4;
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15);
        }
        .auth-input::placeholder { color: #475569; }
        .auth-input-icon {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #475569;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .auth-input-icon:hover { color: #38bdf8; }

        /* Divider */
        .auth-divider {
          border: none;
          border-top: 1px solid rgba(51, 65, 85, 0.4);
          margin: 22px 0;
        }

        /* Submit button */
        .auth-submit {
          width: 100%;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 14px;
          font-size: 14.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          letter-spacing: 0.2px;
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .auth-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(6, 182, 212, 0.45);
          filter: brightness(1.05);
        }
        .auth-submit:active { transform: translateY(0); }
        .auth-submit:disabled { opacity: 0.65; cursor: not-allowed; }

        /* Footer link to admin */
        .admin-portal-hint {
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid rgba(51,65,85,0.3);
          text-align: center;
        }
        .admin-portal-hint p {
          font-size: 12.5px;
          color: #475569;
          margin: 0 0 10px;
        }
        .admin-portal-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: #06b6d4;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
          padding: 7px 16px;
          background: rgba(6, 182, 212, 0.06);
          border: 1px solid rgba(6, 182, 212, 0.15);
          border-radius: 9px;
        }
        .admin-portal-link:hover {
          color: #38bdf8;
          background: rgba(6, 182, 212, 0.12);
          border-color: rgba(6, 182, 212, 0.3);
        }

        /* Info hint text */
        .auth-hint {
          font-size: 11.5px;
          color: #475569;
          margin-top: 5px;
          padding-left: 2px;
        }

        /* Loading spinner */
        @keyframes auth-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .auth-spinner {
          animation: auth-spin 0.8s linear infinite;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .auth-left { display: none; }
          .auth-right {
            width: 100%;
            min-width: unset;
            border-left: none;
            padding: 40px 24px;
            align-items: flex-start;
            padding-top: 60px;
          }
          .auth-right-inner { max-width: 100%; }
        }
      `}</style>

      {/* Background decorations */}
      <div className="auth-grid" />
      <div className="auth-orb-1" />
      <div className="auth-orb-2" />
      <div className="auth-orb-3" />

      {/* LEFT PANEL */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand-mark">
            <div className="auth-logo-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div className="auth-brand-name">Smart Exam Portal</div>
              <div className="auth-brand-tag">AI-Proctored Assessment</div>
            </div>
          </div>

          <h2 className="auth-hero-title">
            Secure.<br />
            <span>Intelligent.</span><br />
            Fair.
          </h2>
          <p className="auth-hero-sub">
            A next-generation online examination platform with AI-powered proctoring, real-time monitoring, and instant results.
          </p>

          <div className="auth-features">
            {[
              { icon: '🎥', text: 'Live camera proctoring with face detection' },
              { icon: '🔒', text: 'Strict security with violation tracking' },
              { icon: '⚡', text: 'Instant automated scoring & results' },
              { icon: '📊', text: 'Admin analytics & performance insights' },
            ].map((f, i) => (
              <div key={i} className="auth-feature-item">
                <div className="auth-feature-dot">
                  <span style={{ fontSize: 16 }}>{f.icon}</span>
                </div>
                <span className="auth-feature-text">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="auth-right">
        <div className="auth-right-inner">
          {/* Title */}
          <h1 className="auth-form-title">
            {mode === 'login' ? 'Welcome back 👋' : 'Create Account'}
          </h1>
          <p className="auth-form-subtitle">
            {mode === 'login'
              ? 'Sign in to access your assigned examinations.'
              : 'Register once to access all your assigned exams.'}
          </p>

          {/* Tab switcher */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : 'auth-tab-inactive'}`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : 'auth-tab-inactive'}`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="auth-field">
                <label className="auth-label">Roll Number / Student ID</label>
                <div className="auth-input-wrap">
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="e.g. 23A91A0501"
                    value={loginRoll}
                    onChange={e => setLoginRoll(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                  <span className="auth-input-icon" style={{ pointerEvents: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Access Password</label>
                <div className="auth-input-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Your password"
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="auth-input-icon"
                    onClick={() => setShowPass(p => !p)}
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <><svg className="auth-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> Signing in...</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                    Sign In to Exam Portal
                  </>
                )}
              </button>

              <p style={{ textAlign: 'center', margin: '16px 0 0', fontSize: '12.5px', color: '#475569' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 'inherit', fontFamily: 'inherit' }}
                >
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              {/* Row: Name + Roll Number */}
              <div className="auth-field-row">
                <div>
                  <label className="auth-label">Full Name</label>
                  <div className="auth-input-wrap">
                    <input
                      type="text"
                      className="auth-input auth-input-no-icon"
                      placeholder="Your full name"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="auth-label">Roll Number</label>
                  <div className="auth-input-wrap">
                    <input
                      type="text"
                      className="auth-input auth-input-no-icon"
                      placeholder="e.g. 23A91A0501"
                      value={regRoll}
                      onChange={e => setRegRoll(e.target.value)}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                </div>
              </div>

              {/* Branch */}
              <div className="auth-field">
                <label className="auth-label">College Branch / Department</label>
                <div className="auth-input-wrap">
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="e.g. CSE, ECE, MECH, CIVIL, IT, EEE..."
                    value={regBranch}
                    onChange={e => setRegBranch(e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <span className="auth-input-icon" style={{ pointerEvents: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </span>
                </div>
                <p className="auth-hint">Type your branch abbreviation manually (e.g. CSE, ECE, IT)</p>
              </div>

              <hr className="auth-divider" />

              {/* Password */}
              <div className="auth-field">
                <label className="auth-label">Create Password</label>
                <div className="auth-input-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Min. 6 characters"
                    value={regPass}
                    onChange={e => setRegPass(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-input-icon"
                    onClick={() => setShowPass(p => !p)}
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Confirm Password</label>
                <div className="auth-input-wrap">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Re-enter password"
                    value={regConfirmPass}
                    onChange={e => setRegConfirmPass(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-input-icon"
                    onClick={() => setShowConfirmPass(p => !p)}
                    tabIndex={-1}
                  >
                    {showConfirmPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <><svg className="auth-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> Registering...</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                    Create Student Account
                  </>
                )}
              </button>

              <p style={{ textAlign: 'center', margin: '16px 0 0', fontSize: '12.5px', color: '#475569' }}>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 'inherit', fontFamily: 'inherit' }}
                >
                  Sign in here
                </button>
              </p>
            </form>
          )}


        </div>
      </div>
    </div>
  );
}
