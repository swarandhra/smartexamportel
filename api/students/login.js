import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { rollNumber, password } = req.body;
  try {
    const rows = await sql`
      SELECT * FROM students WHERE roll_number = ${rollNumber.trim().toUpperCase()}
    `;
    if (rows.length === 0) {
      return res.json({ success: false, error: 'Student not found. Please register first.' });
    }
    const student = rows[0];
    if (student.password !== password.trim()) {
      return res.json({ success: false, error: 'Invalid password. Please check your credentials.' });
    }
    res.json({ success: true, student: { name: student.name, rollNumber: student.roll_number } });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
}
