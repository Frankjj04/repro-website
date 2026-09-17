/* GET /api/share?t=TOKEN — what a scout sees. No password: the unguessable
   token in the link is the key, and it expires or can be turned off.

   Every answer is the same "not available" for a wrong, expired or turned-off
   link, so the page gives nothing away about which it was. */

import { query, isConfigured } from '../lib/db.js';
import { scoutProfile, isToken, LIVE_SHARE, VISIBLE, SCOUT_COLUMNS } from '../lib/scout.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });

  const token = (req.query || {}).t;
  if (!isToken(token)) return res.status(404).json({ error: 'unavailable' });

  try {
    const { rows: shares } = await query(LIVE_SHARE, [token]);
    if (!shares.length) return res.status(404).json({ error: 'unavailable' });
    const share = shares[0];

    const { rows } = await query(
      `SELECT ${SCOUT_COLUMNS} FROM applicants WHERE ${VISIBLE} ORDER BY dob, name`,
      [share.applicant_ids]);

    await query('UPDATE shares SET views = views + 1, last_viewed_at = NOW() WHERE id = $1', [share.id]);

    return res.status(200).json({
      recipient: share.recipient,
      expiresAt: share.expires_at,
      players: rows.map((r) => scoutProfile(r, token)),
    });
  } catch (err) {
    console.error('share failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
