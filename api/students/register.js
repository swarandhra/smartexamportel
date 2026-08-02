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

  const { rollNumber, name, password, branch } = req.body;
  try {
    await sql`
      INSERT INTO students (roll_number, name, password, branch)
      VALUES (${rollNumber.trim().toUpperCase()}, ${name.trim()}, ${password.trim()}, ${(branch || '').trim().toUpperCase()})
    `;
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('duplicate') || e.message.includes('unique')) {
      res.json({ success: false, error: 'Student with this Roll Number is already registered.' });
    } else {
      res.json({ success: false, error: e.message });
    }
  }
}
