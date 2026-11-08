import { timingSafeEqual } from 'node:crypto';

// Shared guard for /api/admin/*. Requires the ADMIN_API_TOKEN env var and an "x-admin-token" request header.
// Returns true when the request may proceed; otherwise it has already sent the response.
export function requireAdmin(req, res) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    res.status(503).json({ success: false, error: 'ADMIN_API_TOKEN is not configured on the server.' });
    return false;
  }
  const given = String(req.headers['x-admin-token'] || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}
