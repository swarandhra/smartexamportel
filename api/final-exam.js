import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      let data;
      try {
        data = fs.readFileSync(path.resolve('./final-exam.json'), 'utf8');
      } catch (e) {
        data = fs.readFileSync(path.resolve('../final-exam.json'), 'utf8');
      }
      return res.status(200).json(JSON.parse(data));
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
