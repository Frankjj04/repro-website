/* GET /api/share-photo?t=TOKEN&id=N — a headshot on a shared link.

   Only for a player the live link is allowed to show right now. */

import { query, isConfigured } from '../lib/db.js';
import { isToken, LIVE_SHARE, VISIBLE } from '../lib/scout.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });

  const { t, id } = req.query || {};
  const n = Number(id);
  if (!isToken(t) || !Number.isInteger(n) || n < 1) return res.status(404).json({ error: 'unavailable' });

  try {
    const { rows: shares } = await query(LIVE_SHARE, [t]);
    if (!shares.length) return res.status(404).json({ error: 'unavailable' });

    const { rows } = await query(
      `SELECT photo, photo_type FROM applicants WHERE ${VISIBLE} AND id = $2`,
      [shares[0].applicant_ids, n]);
    if (!rows.length || !rows[0].photo) return res.status(404).json({ error: 'unavailable' });

    res.setHeader('Content-Type', rows[0].photo_type || 'image/jpeg');
    // Never kept: once a link is turned off, its photos must stop showing too.
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(rows[0].photo);
  } catch (err) {
    console.error('share-photo failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
