import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is missing' });
  }
  const sql = neon(process.env.DATABASE_URL);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  try {
    // Delete associated results first to avoid foreign key constraint violations
    await sql`DELETE FROM results WHERE exam_id = ${id}`;
    // Delete the exam itself
    await sql`DELETE FROM exams WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || String(e) || 'Unknown database error' });
  }
}
