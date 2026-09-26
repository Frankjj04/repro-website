/* GET /api/share?t=TOKEN — what a scout sees.
   GET /api/share?t=TOKEN&photo=N — one headshot on that link (was its own
   file, api/share-photo.js; merged because the free Vercel plan allows 12
   functions). No password: the unguessable
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
  if ((req.query || {}).photo !== undefined) return photo(res, token, (req.query || {}).photo);

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

/* A headshot, only for a player the live link is allowed to show right now. */
async function photo(res, token, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return res.status(404).json({ error: 'unavailable' });
  try {
    const { rows: shares } = await query(LIVE_SHARE, [token]);
    if (!shares.length) return res.status(404).json({ error: 'unavailable' });

    const { rows } = await query(
      `SELECT photo, photo_type FROM applicants WHERE ${VISIBLE} AND id = $2`,
      [shares[0].applicant_ids, n]);
    if (!rows.length || !rows[0].photo) return res.status(404).json({ error: 'unavailable' });

    res.setHeader('Content-Type', rows[0].photo_type || 'image/jpeg');
    // Never kept: once a link is turned off, its photos must stop showing too
    // (the handler already set private, no-store).
    return res.status(200).send(rows[0].photo);
  } catch (err) {
    console.error('share photo failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
