import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function mapResult(r) {
  return {
    id: r.id, examId: r.exam_id, examName: r.exam_name,
    studentName: r.student_name, rollNumber: r.roll_number,
    date: r.date, startTime: r.start_time, endTime: r.end_time, timeTaken: r.time_taken,
    totalQuestions: r.total_questions, correctAnswers: r.correct_answers,
    wrongAnswers: r.wrong_answers, marksObtained: r.marks_obtained,
    totalMarks: r.total_marks, percentage: Number(r.percentage),
    status: r.status, isSubmitted: r.is_submitted,
    cameraViolations: r.camera_violations, microphoneViolations: r.microphone_violations,
    fullscreenViolations: r.fullscreen_violations, tabSwitchingCount: r.tab_switching_count,
    totalViolations: r.total_violations, violationLog: r.violation_log,
    cameraCaptures: r.camera_captures, answers: r.answers
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { rollNumber, examId } = req.query;
  try {
    const examRows = await sql`SELECT resume_window FROM exams WHERE id = ${examId}`;
    const windowMinutes = examRows.length > 0 ? examRows[0].resume_window : 60;

    const rows = await sql`
      SELECT * FROM results
      WHERE roll_number = ${rollNumber.trim().toUpperCase()}
        AND exam_id = ${examId}
        AND is_submitted = false
      LIMIT 1
    `;

    if (rows.length === 0) return res.json({ success: true, data: null });

    const data = rows[0];
    const elapsed = (Date.now() - new Date(data.created_at).getTime()) / 60000;

    if (elapsed < windowMinutes) {
      return res.json({ success: true, data: mapResult(data) });
    } else {
      await sql`UPDATE results SET is_submitted = true WHERE id = ${data.id}`;
      return res.json({ success: true, data: null });
    }
  } catch (e) {
    res.json({ success: false, error: e.message, data: null });
  }
}
