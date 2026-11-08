import { useCallback, useEffect, useState } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, TriangleAlert, RefreshCw } from 'lucide-react';
import { AdminApiError, fetchAdminStudents, getAdminToken, timeAgo } from '../../utils/adminApi';
import type { AdminStudentsPage, StudentStatus } from '../../utils/adminApi';
import AdminTokenGate from './AdminTokenGate';

const STATUS: Record<StudentStatus, [string, string]> = {
  online: ['Online', 'ui-badge--success'],
  'in-exam': ['In exam', 'ui-badge--warning'],
  offline: ['Offline', ''],
};

function exportCsv(rows: AdminStudentsPage['data']) {
  if (rows.length === 0) return;
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = ['Name', 'Roll Number', 'Branch', 'Registered', 'Last Login', 'Last Seen', 'Status'];
  const lines = rows.map(r => [r.name, r.rollNumber, r.branch, r.createdAt || '', r.lastLoginAt || '', r.lastSeenAt || '', r.status].map(v => esc(String(v))).join(','));
  const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function StudentsTab() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [branch, setBranch] = useState('');
  const [sort, setSort] = useState<'created' | 'lastSeen'>('lastSeen');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [data, setData] = useState<AdminStudentsPage | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async () => {
    if (!getAdminToken()) { setError({ status: 401, message: 'No token' }); setLoading(false); return; }
    setLoading(true);
    try {
      setData(await fetchAdminStudents({ page, pageSize, q: debouncedQ, branch, sort, dir }));
      setError(null); setNow(Date.now());
    } catch (e: any) {
      setError({ status: e instanceof AdminApiError ? e.status : 0, message: e?.message || 'Could not load students' });
    } finally { setLoading(false); }
  }, [page, debouncedQ, branch, sort, dir]);

  useEffect(() => { load(); }, [load]);

  if (error && !data) {
    if (error.status === 401 || error.status === 503) return <AdminTokenGate status={error.status} message={error.message} onSaved={load} />;
    return (
      <section className="ad-card ad-gate" role="alert">
        <div className="ad-gate__icon is-danger"><TriangleAlert size={24} strokeWidth={1.75} /></div>
        <h2>Couldn't load students</h2>
        <p className="ad-tip">{error.message}</p>
        <div><button className="ui-btn ui-btn--primary" onClick={load}><RefreshCw size={18} strokeWidth={1.75} /> Try again</button></div>
      </section>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  return (
    <>
      <div className="ad-tools">
        <div className="ad-search">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input className="ad-input" placeholder="Search name or roll number..." aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="ad-select" style={{ maxWidth: 160 }} aria-label="Filter by branch" value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1); }}>
          <option value="">All branches</option>
          {(data?.branches || []).map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="ad-select" style={{ maxWidth: 200 }} aria-label="Sort" value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(':'); setSort(s as any); setDir(d as any); setPage(1); }}>
          <option value="lastSeen:desc">Last seen (newest)</option>
          <option value="lastSeen:asc">Last seen (oldest)</option>
          <option value="created:desc">Registered (newest)</option>
          <option value="created:asc">Registered (oldest)</option>
        </select>
        <span className="ad-tip">{data ? `${data.total} student(s)` : ''}</span>
        <button className="ui-btn ui-btn--secondary" style={{ marginLeft: 'auto' }} onClick={() => data && exportCsv(data.data)} disabled={!data || data.data.length === 0}>
          <Download size={18} strokeWidth={1.75} /> Export CSV
        </button>
      </div>

      <div className="ad-tablewrap" aria-busy={loading}>
        <table className="ad-table">
          <thead><tr><th>Name</th><th>Roll Number</th><th>Branch</th><th>Status</th><th>Last seen</th><th>Last login</th><th>Registered</th></tr></thead>
          <tbody>
            {loading && !data ? Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={7}><div className="ui-skeleton" style={{ height: 20 }} /></td></tr>)
              : data && data.data.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>No students match your filters.</td></tr>
              : data?.data.map(s => {
                const [label, cls] = STATUS[s.status];
                return (
                  <tr key={s.rollNumber}>
                    <td><strong>{s.name}</strong></td>
                    <td className="num">{s.rollNumber}</td>
                    <td><span className="ui-badge ui-badge--primary">{(s.branch || 'N/A').toUpperCase()}</span></td>
                    <td><span className={`ui-badge ${cls}`} style={cls ? undefined : { background: 'var(--surface-3)', color: 'var(--text-2)' }}>{label}</span></td>
                    <td>{timeAgo(s.lastSeenAt, now)}</td>
                    <td>{timeAgo(s.lastLoginAt, now)}</td>
                    <td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="ad-pager">
        <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}><ChevronLeft size={16} strokeWidth={1.75} /> Previous</button>
        <span className="ad-tip">Page {page} of {totalPages}</span>
        <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Next <ChevronRight size={16} strokeWidth={1.75} /></button>
      </div>
    </>
  );
}
