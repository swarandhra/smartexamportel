import { neon } from '@neondatabase/serverless';

// Lightweight per-student results for the student dashboard: no answers, violation logs or images.
export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is missing' });
  }
  const sql = neon(process.env.DATABASE_URL);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rollNumber = String(req.query.rollNumber || '').trim().toUpperCase();
  if (!rollNumber) return res.status(400).json({ success: false, error: 'rollNumber is required', data: [] });
  try {
    const rows = await sql`
      SELECT id, exam_id, exam_name, student_name, roll_number, date, start_time, end_time, time_taken,
             total_questions, marks_obtained, total_marks, percentage, status, is_submitted
      FROM results WHERE roll_number = ${rollNumber} ORDER BY created_at DESC
    `;
    res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id, examId: r.exam_id, examName: r.exam_name, studentName: r.student_name, rollNumber: r.roll_number,
        date: r.date, startTime: r.start_time, endTime: r.end_time, timeTaken: r.time_taken,
        totalQuestions: r.total_questions, marksObtained: r.marks_obtained, totalMarks: r.total_marks,
        percentage: Number(r.percentage), status: r.status, isSubmitted: r.is_submitted
      }))
    });
  } catch (e) {
    res.json({ success: false, error: e.message, data: [] });
  }
}
