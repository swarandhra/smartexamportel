import { useCallback, useEffect, useState } from 'react';
import { Users, Radio, PencilLine, LogIn, UserPlus, UserX, RefreshCw, TriangleAlert, FileText, Inbox } from 'lucide-react';
import type { Exam, Result } from '../../utils/db';
import { AdminApiError, fetchAdminStats, getAdminToken, timeAgo } from '../../utils/adminApi';
import type { AdminStats } from '../../utils/adminApi';
import AdminTokenGate from './AdminTokenGate';
import CountUp from './CountUp';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

export default function OverviewTab({ exams, results }: { exams: Exam[]; results: Result[] }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (manual = false) => {
    if (!getAdminToken()) { setError({ status: 401, message: 'No token' }); setLoading(false); return; }
    if (manual) setRefreshing(true);
    try {
      const s = await fetchAdminStats();
      setStats(s); setError(null); setUpdatedAt(Date.now());
    } catch (e: any) {
      setError({ status: e instanceof AdminApiError ? e.status : 0, message: e?.message || 'Could not load statistics' });
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s while this tab is mounted and visible; tick the "updated" label every second.
  useEffect(() => {
    const refresh = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(refresh); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading overview">
        <div className="ad-stats ad-stats--six">{Array.from({ length: 6 }, (_, i) => <div key={i} className="ui-skeleton" style={{ height: 96, borderRadius: 16 }} />)}</div>
        <div className="ad-charts"><div className="ui-skeleton" style={{ height: 240, borderRadius: 16 }} /><div className="ui-skeleton" style={{ height: 240, borderRadius: 16 }} /></div>
      </div>
    );
  }

  if (error && !stats) {
    if (error.status === 401 || error.status === 503) return <AdminTokenGate status={error.status} message={error.message} onSaved={() => { setLoading(true); load(); }} />;
    return (
      <section className="ad-card ad-gate" role="alert">
        <div className="ad-gate__icon is-danger"><TriangleAlert size={24} strokeWidth={1.75} /></div>
        <h2>Couldn't load student statistics</h2>
        <p className="ad-tip">{error.message}. If you're running locally with only <code>npm run dev</code>, the /api routes aren't available. Use <code>vercel dev</code> or the deployed site.</p>
        <div><button className="ui-btn ui-btn--primary" onClick={() => { setLoading(true); load(); }}><RefreshCw size={18} strokeWidth={1.75} /> Try again</button></div>
      </section>
    );
  }
  if (!stats) return null;

  const cards = [
    { label: 'Total registered', value: stats.totalRegistered, icon: Users, caption: `${stats.registeredToday} today` },
    { label: 'Online now', value: stats.onlineNow, icon: Radio, caption: 'Active in the last 2 min', live: true },
    { label: 'Writing an exam now', value: stats.inExamNow, icon: PencilLine, caption: 'Exam in progress' },
    { label: 'Logged in today', value: stats.loggedInToday, icon: LogIn, caption: 'Since midnight (IST)' },
    { label: 'New this week', value: stats.registeredThisWeek, icon: UserPlus, caption: 'Last 7 days' },
    { label: 'Never logged in', value: stats.neverLoggedIn, icon: UserX, caption: 'Registered, no login yet', warn: true },
  ];

  const maxBranch = Math.max(1, ...stats.byBranch.map(b => b.count));
  const days = stats.loginsByDay;
  const maxDay = Math.max(1, ...days.map(d => d.count));
  const W = 320, H = 120, padX = 16, padY = 16;
  const pts = days.map((d, i) => [padX + (i * (W - padX * 2)) / Math.max(1, days.length - 1), H - padY - (d.count / maxDay) * (H - padY * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${H - padY} L${pts[0][0]},${H - padY} Z` : '';

  const nowMs = Date.now();
  const activeExams = exams.filter(e => nowMs >= new Date(e.startDate).getTime() && nowMs <= new Date(e.endDate).getTime()).length;
  const submitted = results.filter(r => r.isSubmitted);
  const passRate = submitted.length ? (submitted.filter(r => r.status === 'Pass').length / submitted.length) * 100 : 0;

  return (
    <>
      <div className="ad-refresh">
        <span className="ad-tip" role="status" aria-live="polite">{error ? 'Refresh failed. Showing the last data.' : `Updated ${updatedAt ? timeAgo(new Date(updatedAt).toISOString(), now) : '…'}`}</span>
        <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} strokeWidth={1.75} className={refreshing ? 'ui-spinner' : ''} /> Refresh
        </button>
      </div>

      <div className="ad-stats ad-stats--six ui-stagger">
        {cards.map(c => (
          <div key={c.label} className="ad-stat ad-card">
            <div className={`ad-stat__icon ${c.warn ? 'is-warn' : ''}`}><c.icon size={22} strokeWidth={1.75} /></div>
            <div>
              <span>{c.label}</span>
              <b>{c.live && c.value > 0 && <i className="ad-live-dot" aria-hidden="true" />}<CountUp value={c.value} /></b>
              <small>{c.caption}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="ad-charts">
        <section className="ad-card">
          <div className="ad-card__head"><h2>Registrations by branch</h2><span className="ad-tip">{stats.byBranch.length} branches</span></div>
          <div className="ad-card__body ad-hbar">
            {stats.byBranch.length === 0 ? <p className="ad-tip">No students registered yet.</p> : stats.byBranch.map(b => (
              <div key={b.branch} className="ad-hbar__row">
                <span>{b.branch}</span>
                <div className="ad-hbar__track"><div className="ad-hbar__fill ad-hbar__fill--accent" style={{ width: `${(b.count / maxBranch) * 100}%` }}></div></div>
                <span className="ad-hbar__val">{b.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ad-card">
          <div className="ad-card__head"><h2>Logins over the last 7 days</h2><span className="ad-tip">Students by latest login day</span></div>
          <div className="ad-card__body">
            <svg viewBox={`0 0 ${W} ${H + 22}`} className="ad-line" role="img" aria-label={`Logins per day: ${days.map(d => `${d.day} ${d.count}`).join(', ')}`}>
              {[0, 0.5, 1].map(f => <line key={f} x1={padX} x2={W - padX} y1={padY + f * (H - padY * 2)} y2={padY + f * (H - padY * 2)} className="ad-line__grid" />)}
              {area && <path d={area} className="ad-line__area" />}
              {line && <path d={line} className="ad-line__path" />}
              {pts.map(([x, y], i) => (
                <g key={days[i].day}>
                  <circle cx={x} cy={y} r="3.5" className="ad-line__dot"><title>{`${days[i].day}: ${days[i].count}`}</title></circle>
                  <text x={x} y={y - 8} textAnchor="middle" className="ad-line__val">{days[i].count}</text>
                  <text x={x} y={H + 14} textAnchor="middle" className="ad-line__lbl">{new Date(days[i].day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</text>
                </g>
              ))}
            </svg>
          </div>
        </section>
      </div>

      <div className="ad-charts">
        <section className="ad-card">
          <div className="ad-card__head"><h2>Recent registrations</h2></div>
          <ul className="ad-people">
            {stats.recentRegistrations.length === 0 && <li className="ad-tip" style={{ padding: 20 }}><Inbox size={16} strokeWidth={1.75} /> No registrations yet.</li>}
            {stats.recentRegistrations.map(p => (
              <li key={p.rollNumber}>
                <span className="ad-avatar" aria-hidden="true">{initials(p.name)}</span>
                <div><b>{p.name}</b><span className="ui-mono">{p.rollNumber}</span></div>
                <span className="ui-badge ui-badge--primary">{(p.branch || 'N/A').toUpperCase()}</span>
                <time>{timeAgo(p.createdAt, now)}</time>
              </li>
            ))}
          </ul>
        </section>
        <section className="ad-card">
          <div className="ad-card__head"><h2>Recent logins</h2></div>
          <ul className="ad-people">
            {stats.recentLogins.length === 0 && <li className="ad-tip" style={{ padding: 20 }}><Inbox size={16} strokeWidth={1.75} /> No logins recorded yet.</li>}
            {stats.recentLogins.map(p => (
              <li key={p.rollNumber}>
                <span className="ad-avatar" aria-hidden="true">{initials(p.name)}</span>
                <div><b>{p.name}</b><span className="ui-mono">{p.rollNumber}</span></div>
                <time>{timeAgo(p.lastLoginAt, now)}</time>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="ad-card" style={{ marginTop: 'var(--sp-4)' }}>
        <div className="ad-card__head"><h2>Exams at a glance</h2><FileText size={18} strokeWidth={1.75} aria-hidden="true" /></div>
        <div className="ad-card__body ad-glance">
          <div><span>Active exams</span><b className="ui-mono">{activeExams}</b></div>
          <div><span>Total submissions</span><b className="ui-mono">{submitted.length}</b></div>
          <div><span>Pass rate</span><b className="ui-mono">{passRate.toFixed(0)}%</b></div>
        </div>
      </section>
    </>
  );
}
