import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is missing' });
  }
  const sql = neon(process.env.DATABASE_URL);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — fetch all exams
  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM exams ORDER BY created_at DESC`;
      const exams = rows.map(e => ({
        id: e.id,
        title: e.title,
        duration: e.duration,
        passingMarks: e.passing_marks,
        startDate: e.start_date,
        endDate: e.end_date,
        shuffleQuestions: e.shuffle_questions,
        shuffleOptions: e.shuffle_options,
        showResultToStudent: e.show_result_to_student,
        resumeWindow: e.resume_window || 60,
        questions: e.questions
      }));
      return res.json({ success: true, data: exams });
    } catch (e) {
      return res.json({ success: false, error: e.message, data: [] });
    }
  }

  // POST — create exam
  if (req.method === 'POST') {
    const exam = req.body;
    try {
      await sql`
        INSERT INTO exams (id, title, duration, passing_marks, start_date, end_date,
          shuffle_questions, shuffle_options, show_result_to_student, resume_window, questions)
        VALUES (
          ${exam.id}, ${exam.title}, ${exam.duration}, ${exam.passingMarks},
          ${exam.startDate}, ${exam.endDate}, ${exam.shuffleQuestions}, ${exam.shuffleOptions},
          ${exam.showResultToStudent}, ${exam.resumeWindow || 60}, ${JSON.stringify(exam.questions)}
        )
      `;
      return res.json({ success: true });
    } catch (e) {
      return res.json({ success: false, error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
