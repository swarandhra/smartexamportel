import React, { useState } from 'react';
import { getSettings } from '../utils/db';
import { showToast } from '../utils/notifications';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="admin-login-wrapper">
      <style>{`
        .admin-login-wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 40%, #0a0f1e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }
        .admin-login-wrapper::before {
          content: '';
          position: absolute;
          top: -30%;
          left: -20%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .admin-login-wrapper::after {
          content: '';
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .admin-card {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 24px;
          padding: 48px 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.6);
          backdrop-filter: blur(20px);
          position: relative;
          z-index: 1;
          animation: admin-card-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes admin-card-in {
          from { transform: translateY(24px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .admin-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 100px;
          padding: 6px 16px;
          font-size: 11.5px;
          font-weight: 700;
          color: #a5b4fc;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          width: fit-content;
          margin: 0 auto 28px;
        }
        .admin-icon-wrap {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15));
          border: 2px solid rgba(99, 102, 241, 0.4);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 0 8px 24px rgba(99,102,241,0.2);
        }
        .admin-title {
          font-size: 26px;
          font-weight: 800;
          color: #f8fafc;
          text-align: center;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }
        .admin-subtitle {
          font-size: 13.5px;
          color: #64748b;
          text-align: center;
          margin: 0 0 36px;
        }
        .admin-form-group {
          margin-bottom: 20px;
        }
        .admin-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 8px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .admin-input-wrap {
          position: relative;
        }
        .admin-input {
          width: 100%;
          background: rgba(30, 41, 59, 0.8);
          border: 1.5px solid rgba(51, 65, 85, 0.8);
          border-radius: 12px;
          padding: 14px 48px 14px 16px;
          font-size: 15px;
          color: #f8fafc;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
          font-family: inherit;
        }
        .admin-input:focus {
          border-color: rgba(99, 102, 241, 0.7);
          background: rgba(30, 41, 59, 1);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
        .admin-input::placeholder {
          color: #475569;
        }
        .toggle-pass-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
          padding: 4px;
          transition: color 0.2s;
          display: flex;
          align-items: center;
        }
        .toggle-pass-btn:hover { color: #a5b4fc; }
        .admin-submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 15px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s;
          margin-top: 8px;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
          letter-spacing: 0.3px;
          font-family: inherit;
        }
        .admin-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(99, 102, 241, 0.5);
        }
        .admin-submit-btn:active { transform: translateY(0); }
        .admin-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .admin-back-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 24px;
          font-size: 13px;
          color: #475569;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s;
        }
        .admin-back-link:hover { color: #94a3b8; }
        .admin-warning-box {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .admin-warning-box p {
          margin: 0;
          font-size: 12.5px;
          color: #f87171;
          line-height: 1.5;
        }
        .grid-dots {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: radial-gradient(rgba(99,102,241,0.08) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 0;
        }
      `}</style>

      <div className="grid-dots" />

      <div className="admin-card">
        {/* Badge */}
        <div className="admin-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="5" />
          </svg>
          Restricted Access
        </div>

        {/* Icon */}
        <div className="admin-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <circle cx="12" cy="16" r="1" fill="#a5b4fc"/>
          </svg>
        </div>

        <h1 className="admin-title">Admin Portal</h1>
        <p className="admin-subtitle">Teacher & Administrator Access</p>

        {/* Warning */}
        <div className="admin-warning-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p>This area is for <strong>authorized staff only</strong>. Unauthorized access attempts are logged.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label className="admin-label">Admin Password</label>
            <div className="admin-input-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                className="admin-input"
                placeholder="Enter administrator password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                className="toggle-pass-btn"
                onClick={() => setShowPass(p => !p)}
                tabIndex={-1}
              >
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="admin-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Verifying...
              </span>
            ) : (
              '🔓 Access Admin Panel'
            )}
          </button>
        </form>

        <a
          className="admin-back-link"
          onClick={() => window.location.href = '/'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Student Portal
        </a>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
