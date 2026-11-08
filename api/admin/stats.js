import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../_adminAuth.js';

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
  try {
    // "Today" is the calendar day in Asia/Kolkata.
    const [counts] = await sql`
      WITH t AS (SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')) AT TIME ZONE 'Asia/Kolkata' AS today_start)
      SELECT
        count(*)::int AS total_registered,
        count(*) FILTER (WHERE created_at >= t.today_start)::int AS registered_today,
        count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS registered_this_week,
        count(*) FILTER (WHERE last_login_at >= t.today_start)::int AS logged_in_today,
        count(*) FILTER (WHERE last_seen_at > now() - interval '2 minutes')::int AS online_now,
        count(*) FILTER (WHERE in_exam_at > now() - interval '2 minutes')::int AS in_exam_now,
        count(*) FILTER (WHERE last_login_at IS NULL)::int AS never_logged_in
      FROM students, t
    `;
    const byBranch = await sql`
      SELECT COALESCE(NULLIF(upper(trim(branch)), ''), 'UNKNOWN') AS branch, count(*)::int AS count
      FROM students GROUP BY 1 ORDER BY count DESC, branch ASC LIMIT 12
    `;
    const recentRegistrations = await sql`
      SELECT name, roll_number, branch, created_at FROM students ORDER BY created_at DESC NULLS LAST LIMIT 8
    `;
    const recentLogins = await sql`
      SELECT name, roll_number, last_login_at FROM students WHERE last_login_at IS NOT NULL ORDER BY last_login_at DESC LIMIT 8
    `;
    // Students whose most recent login fell on each of the last 7 Kolkata days (only the latest login is stored per student).
    const loginsByDay = await sql`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day, count(s.roll_number)::int AS count
      FROM generate_series(
        (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '6 days'),
        date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata'),
        interval '1 day') AS d(day)
      LEFT JOIN students s ON date_trunc('day', s.last_login_at AT TIME ZONE 'Asia/Kolkata') = d.day
      GROUP BY d.day ORDER BY d.day
    `;

    res.json({
      success: true,
      totalRegistered: counts.total_registered,
      registeredToday: counts.registered_today,
      registeredThisWeek: counts.registered_this_week,
      loggedInToday: counts.logged_in_today,
      onlineNow: counts.online_now,
      inExamNow: counts.in_exam_now,
      neverLoggedIn: counts.never_logged_in,
      byBranch: byBranch.map(r => ({ branch: r.branch, count: r.count })),
      recentRegistrations: recentRegistrations.map(r => ({ name: r.name, rollNumber: r.roll_number, branch: r.branch, createdAt: r.created_at })),
      recentLogins: recentLogins.map(r => ({ name: r.name, rollNumber: r.roll_number, lastLoginAt: r.last_login_at })),
      loginsByDay
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
