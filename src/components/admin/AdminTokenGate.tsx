import { useState } from 'react';
import { KeyRound, Save, TriangleAlert } from 'lucide-react';
import { setAdminToken } from '../../utils/adminApi';

/** Shown when the admin stats API rejects the request (no token, wrong token, or not configured on the server). */
export default function AdminTokenGate({ status, message, onSaved }: { status: number; message: string; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const notConfigured = status === 503;
  return (
    <section className="ad-card ad-gate" role="alert">
      <div className="ad-gate__icon"><KeyRound size={24} strokeWidth={1.75} /></div>
      <h2>{notConfigured ? 'Admin API token not configured' : status === 401 ? 'Admin API token needed' : 'Admin API unavailable'}</h2>
      <p className="ad-tip">
        {notConfigured
          ? 'Set the ADMIN_API_TOKEN environment variable on the server (Vercel project settings), redeploy, then enter the same value below.'
          : 'Student statistics are protected by a server-side token. Enter the ADMIN_API_TOKEN value configured on the server. It is kept in this browser only.'}
      </p>
      {status !== 401 && status !== 503 && <p className="ad-gate__err"><TriangleAlert size={16} strokeWidth={1.75} /> {message}</p>}
      {status === 401 && <p className="ad-gate__err"><TriangleAlert size={16} strokeWidth={1.75} /> The saved token was rejected.</p>}
      <form className="ad-gate__form" onSubmit={(e) => { e.preventDefault(); setAdminToken(value.trim()); onSaved(); }}>
        <input type="password" className="ad-input" aria-label="Admin API token" placeholder="Admin API token" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!value.trim()}><Save size={18} strokeWidth={1.75} /> Save token</button>
      </form>
    </section>
  );
}
