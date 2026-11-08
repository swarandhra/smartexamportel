import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is missing' });
  }
  const sql = neon(process.env.DATABASE_URL);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { rollNumber, inExam } = req.body || {};
  if (!rollNumber || typeof rollNumber !== 'string') {
    return res.status(400).json({ success: false, error: 'rollNumber is required' });
  }
  try {
    await sql`
      UPDATE students
      SET last_seen_at = now(),
          in_exam_at = CASE WHEN ${inExam === true} THEN now() ELSE in_exam_at END
      WHERE roll_number = ${rollNumber.trim().toUpperCase()}
    `;
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
}
