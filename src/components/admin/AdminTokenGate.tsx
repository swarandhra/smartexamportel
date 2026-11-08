import { useState } from 'react';
import { KeyRound, Save, TriangleAlert } from 'lucide-react';
import { getAdminToken, setAdminToken } from '../../utils/adminApi';

/** Shown when the admin stats API rejects the request (no token, wrong token, or not configured on the server). */
export default function AdminTokenGate({ status, message, onSaved }: { status: number; message: string; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const notConfigured = status === 503;
  const hadToken = !!getAdminToken();
  return (
    <section className="ad-card ad-gate" role="alert">
      <div className="ad-gate__icon"><KeyRound size={24} strokeWidth={1.75} /></div>
      <h2>{notConfigured ? 'Admin API token not configured' : status === 401 ? 'Sign in again to see statistics' : 'Admin API unavailable'}</h2>
      <p className="ad-tip">
        {notConfigured
          ? 'Set the ADMIN_API_TOKEN environment variable on the server (Vercel project settings), redeploy, then enter the same value below.'
          : hadToken
            ? 'The server did not accept the saved password. ADMIN_API_TOKEN on the server must be the same as your admin login password.'
            : 'Log out and sign in again with your admin password to enable student statistics on this device. Or enter it below.'}
      </p>
      {status !== 401 && status !== 503 && <p className="ad-gate__err"><TriangleAlert size={16} strokeWidth={1.75} /> {message}</p>}
      {status === 401 && hadToken && <p className="ad-gate__err"><TriangleAlert size={16} strokeWidth={1.75} /> The saved password was rejected.</p>}
      <form className="ad-gate__form" onSubmit={(e) => { e.preventDefault(); setAdminToken(value.trim()); onSaved(); }}>
        <input type="password" className="ad-input" aria-label="Admin password" placeholder="Admin password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!value.trim()}><Save size={18} strokeWidth={1.75} /> Save</button>
      </form>
    </section>
  );
}
