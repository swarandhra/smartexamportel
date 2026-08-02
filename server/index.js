import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';

const app = express();
const PORT = process.env.PORT || 3001;

const DATABASE_URL = 'postgresql://neondb_owner:npg_pYZa4K0hTPLD@ep-long-grass-azw38k3p.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({ status: 'ok', db: 'Neon PostgreSQL connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ─── STUDENTS ────────────────────────────────────────────────────

// Register student
app.post('/api/students/register', async (req, res) => {
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
});

// Authenticate student
app.post('/api/students/login', async (req, res) => {
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
});

// ─── EXAMS ────────────────────────────────────────────────────────

// Get all exams
app.get('/api/exams', async (req, res) => {
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
    res.json({ success: true, data: exams });
  } catch (e) {
    res.json({ success: false, error: e.message, data: [] });
  }
});

// Add exam
app.post('/api/exams', async (req, res) => {
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
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Delete exam
app.delete('/api/exams/:id', async (req, res) => {
  try {
    await sql`DELETE FROM exams WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─── RESULTS ─────────────────────────────────────────────────────

// Get all results
app.get('/api/results', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM results ORDER BY created_at DESC`;
    const results = rows.map(mapResult);
    res.json({ success: true, data: results });
  } catch (e) {
    res.json({ success: false, error: e.message, data: [] });
  }
});

// Check active draft
app.get('/api/results/draft', async (req, res) => {
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
    const start = new Date(data.created_at).getTime();
    const elapsed = (Date.now() - start) / 60000;

    if (elapsed < windowMinutes) {
      return res.json({ success: true, data: mapResult(data) });
    } else {
      await sql`UPDATE results SET is_submitted = true WHERE id = ${data.id}`;
      return res.json({ success: true, data: null });
    }
  } catch (e) {
    res.json({ success: false, error: e.message, data: null });
  }
});

// Add result (upsert)
app.post('/api/results', async (req, res) => {
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
        answers = EXCLUDED.answers,
        violation_log = EXCLUDED.violation_log,
        camera_captures = EXCLUDED.camera_captures,
        camera_violations = EXCLUDED.camera_violations,
        microphone_violations = EXCLUDED.microphone_violations,
        fullscreen_violations = EXCLUDED.fullscreen_violations,
        tab_switching_count = EXCLUDED.tab_switching_count,
        total_violations = EXCLUDED.total_violations,
        status = EXCLUDED.status,
        is_submitted = EXCLUDED.is_submitted,
        marks_obtained = EXCLUDED.marks_obtained,
        percentage = EXCLUDED.percentage,
        end_time = EXCLUDED.end_time,
        time_taken = EXCLUDED.time_taken
    `;
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Update result draft (during exam)
app.patch('/api/results/:id/draft', async (req, res) => {
  const { answers, violationLog, cameraCaptures } = req.body;
  const cameraViolations = violationLog.filter(l => l.type.includes('Camera')).length;
  const microphoneViolations = violationLog.filter(l => l.type.includes('Voice')).length;
  const fullscreenViolations = violationLog.filter(l => l.type.includes('Fullscreen')).length;
  const tabSwitchingCount = violationLog.filter(l => l.type.includes('Tab') || l.type.includes('Unfocus')).length;
  try {
    await sql`
      UPDATE results SET
        answers = ${JSON.stringify(answers)},
        violation_log = ${JSON.stringify(violationLog)},
        camera_captures = ${JSON.stringify(cameraCaptures)},
        camera_violations = ${cameraViolations},
        microphone_violations = ${microphoneViolations},
        fullscreen_violations = ${fullscreenViolations},
        tab_switching_count = ${tabSwitchingCount},
        total_violations = ${violationLog.length}
      WHERE id = ${req.params.id} AND is_submitted = false
    `;
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─── Helper ──────────────────────────────────────────────────────
function mapResult(r) {
  return {
    id: r.id,
    examId: r.exam_id,
    examName: r.exam_name,
    studentName: r.student_name,
    rollNumber: r.roll_number,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    timeTaken: r.time_taken,
    totalQuestions: r.total_questions,
    correctAnswers: r.correct_answers,
    wrongAnswers: r.wrong_answers,
    marksObtained: r.marks_obtained,
    totalMarks: r.total_marks,
    percentage: Number(r.percentage),
    status: r.status,
    isSubmitted: r.is_submitted,
    cameraViolations: r.camera_violations,
    microphoneViolations: r.microphone_violations,
    fullscreenViolations: r.fullscreen_violations,
    tabSwitchingCount: r.tab_switching_count,
    totalViolations: r.total_violations,
    violationLog: r.violation_log,
    cameraCaptures: r.camera_captures,
    answers: r.answers
  };
}

app.listen(PORT, () => {
  console.log(`🚀 Smart Exam Portal API running on http://localhost:${PORT}`);
  console.log(`📦 Connected to: Neon PostgreSQL`);
});
