import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is missing' });
  }
  const sql = neon(process.env.DATABASE_URL);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
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
      WHERE id = ${id} AND is_submitted = false
    `;
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
}
