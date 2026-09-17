/* GET /api/photo?id=N — one applicant's headshot.

   Behind the coach's password: these are photos of real people, many of them
   minors. */

import { query, isConfigured } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });

  const id = Number((req.query || {}).id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'bad_id' });

  try {
    const { rows } = await query('SELECT photo, photo_type FROM applicants WHERE id = $1', [id]);
    if (!rows.length || !rows[0].photo) return res.status(404).json({ error: 'not_found' });

    res.setHeader('Content-Type', rows[0].photo_type || 'image/jpeg');
    // The list shows every face on each render, so let the browser keep them
    // for a while — privately, never in a shared cache.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).send(rows[0].photo);
  } catch (err) {
    console.error('photo failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
