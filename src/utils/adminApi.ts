const API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';
const TOKEN_KEY = 'ui-admin-token';

export type StudentStatus = 'online' | 'in-exam' | 'offline';
export interface AdminStats {
  totalRegistered: number; registeredToday: number; registeredThisWeek: number; loggedInToday: number;
  onlineNow: number; inExamNow: number; neverLoggedIn: number;
  byBranch: { branch: string; count: number }[];
  recentRegistrations: { name: string; rollNumber: string; branch: string; createdAt: string }[];
  recentLogins: { name: string; rollNumber: string; lastLoginAt: string }[];
  loginsByDay: { day: string; count: number }[];
}
export interface AdminStudent {
  name: string; rollNumber: string; branch: string; createdAt: string | null;
  lastLoginAt: string | null; lastSeenAt: string | null; status: StudentStatus;
}
export interface AdminStudentsPage { page: number; pageSize: number; total: number; branches: string[]; data: AdminStudent[] }

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export const getAdminToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setAdminToken = (t: string) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { 'x-admin-token': getAdminToken() } });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok || !body || body.success === false) {
    throw new AdminApiError(body?.error || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export const fetchAdminStats = () => adminGet<AdminStats>('/api/admin/stats');
export const fetchAdminStudents = (p: { page: number; pageSize: number; q: string; branch: string; sort: 'created' | 'lastSeen'; dir: 'asc' | 'desc' }) =>
  adminGet<AdminStudentsPage>(`/api/admin/students?${new URLSearchParams({ ...p, page: String(p.page), pageSize: String(p.pageSize) }).toString()}`);

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}
