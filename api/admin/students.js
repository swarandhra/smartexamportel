import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../_adminAuth.js';

// Whitelisted ORDER BY clauses (never interpolate user input into SQL text).
const ORDERS = {
  'created:desc': 'created_at DESC NULLS LAST',
  'created:asc': 'created_at ASC NULLS LAST',
  'lastSeen:desc': 'last_seen_at DESC NULLS LAST',
  'lastSeen:asc': 'last_seen_at ASC NULLS FIRST',
};

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is missing' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const sql = neon(process.env.DATABASE_URL);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
  const q = String(req.query.q || '').trim();
  const branch = String(req.query.branch || '').trim().toUpperCase();
  const order = ORDERS[`${req.query.sort === 'lastSeen' ? 'lastSeen' : 'created'}:${req.query.dir === 'asc' ? 'asc' : 'desc'}`];

  try {
    const where = `WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR roll_number ILIKE '%' || $1 || '%')
                   AND ($2 = '' OR upper(trim(branch)) = $2)`;
    // The password column is never selected.
    const rows = await sql.query(
      `SELECT name, roll_number, branch, created_at, last_login_at, last_seen_at,
              CASE WHEN in_exam_at > now() - interval '2 minutes' THEN 'in-exam'
                   WHEN last_seen_at > now() - interval '2 minutes' THEN 'online'
                   ELSE 'offline' END AS status
       FROM students ${where} ORDER BY ${order} LIMIT $3 OFFSET $4`,
      [q, branch, pageSize, (page - 1) * pageSize]
    );
    const [{ total }] = await sql.query(`SELECT count(*)::int AS total FROM students ${where}`, [q, branch]);
    const branches = await sql`SELECT DISTINCT upper(trim(branch)) AS branch FROM students WHERE trim(branch) <> '' ORDER BY 1`;

    res.json({
      success: true,
      page, pageSize, total,
      branches: branches.map(b => b.branch),
      data: rows.map(r => ({
        name: r.name, rollNumber: r.roll_number, branch: r.branch,
        createdAt: r.created_at, lastLoginAt: r.last_login_at, lastSeenAt: r.last_seen_at, status: r.status
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
