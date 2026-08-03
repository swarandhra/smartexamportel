import { neon } from '@neondatabase/serverless';

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
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is missing' });
  }
  const sql = neon(process.env.DATABASE_URL);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — get all results
  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM results ORDER BY created_at DESC`;
      return res.json({ success: true, data: rows.map(mapResult) });
    } catch (e) {
      return res.json({ success: false, error: e.message, data: [] });
    }
  }

  // POST — upsert result
  if (req.method === 'POST') {
    const r = req.body;
    try {
      await sql`
        INSERT INTO results (
          id, exam_id, exam_name, student_name, roll_number, branch,
          date, start_time, end_time, time_taken,
          total_questions, correct_answers, wrong_answers,
          marks_obtained, total_marks, percentage, status, is_submitted,
          camera_violations, microphone_violations, fullscreen_violations,
          tab_switching_count, total_violations,
          violation_log, camera_captures, answers
        ) VALUES (
          ${r.id}, ${r.examId}, ${r.examName}, ${r.studentName}, ${r.rollNumber}, ${r.branch || ''},
          ${r.date}, ${r.startTime}, ${r.endTime}, ${r.timeTaken},
          ${r.totalQuestions}, ${r.correctAnswers}, ${r.wrongAnswers},
          ${r.marksObtained}, ${r.totalMarks}, ${r.percentage}, ${r.status}, ${r.isSubmitted},
          ${r.cameraViolations}, ${r.microphoneViolations}, ${r.fullscreenViolations},
          ${r.tabSwitchingCount}, ${r.totalViolations},
          ${JSON.stringify(r.violationLog)}, ${JSON.stringify(r.cameraCaptures)}, ${JSON.stringify(r.answers)}
        )
        ON CONFLICT (id) DO UPDATE SET
          answers = EXCLUDED.answers, violation_log = EXCLUDED.violation_log,
          camera_captures = EXCLUDED.camera_captures,
          camera_violations = EXCLUDED.camera_violations,
          microphone_violations = EXCLUDED.microphone_violations,
          fullscreen_violations = EXCLUDED.fullscreen_violations,
          tab_switching_count = EXCLUDED.tab_switching_count,
          total_violations = EXCLUDED.total_violations,
          status = EXCLUDED.status, is_submitted = EXCLUDED.is_submitted,
          marks_obtained = EXCLUDED.marks_obtained, percentage = EXCLUDED.percentage,
          correct_answers = EXCLUDED.correct_answers, wrong_answers = EXCLUDED.wrong_answers,
          end_time = EXCLUDED.end_time, time_taken = EXCLUDED.time_taken
      `;
      return res.json({ success: true });
    } catch (e) {
      return res.json({ success: false, error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
