/* Managing one applicant from the admin page. All behind the password.

   PATCH  /api/applicant?id=N   { status } | { note } | { restore: true }
   DELETE /api/applicant?id=N   { confirmName } — archive (recoverable)

   Archiving requires the applicant's exact name, checked here on the server,
   so a stray click or a mistyped URL cannot remove anybody. */

import { query, isConfigured } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { clean } from '../lib/validate.js';
import { toJson, COLUMNS } from './applicants.js';

const STATUSES = ['pending', 'selected', 'not_selected'];

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });

  const id = Number((req.query || {}).id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'bad_id' });

  try {
    if (req.method === 'PATCH') return await patch(req, res, id);
    if (req.method === 'DELETE') return await archive(req, res, id);
  } catch (err) {
    console.error('applicant failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function patch(req, res, id) {
  const b = req.body || {};
  let rows;

  if (b.restore === true) {
    try {
      ({ rows } = await query(
        `UPDATE applicants SET deleted_at = NULL, updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NOT NULL RETURNING ${COLUMNS}`, [id]));
    } catch (err) {
      // Restoring would collide with a newer application from the same email.
      if (err && err.code === '23505') {
        return res.status(409).json({ error: 'duplicate',
          message: 'Este email ya tiene otra solicitud activa para este evento.' });
      }
      throw err;
    }
  } else if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'bad_status' });
    ({ rows } = await query(
      `UPDATE applicants SET status = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLUMNS}`, [id, b.status]));
  } else if (b.note !== undefined) {
    // The note keeps its line breaks, unlike the form fields.
    const note = String(b.note == null ? '' : b.note).slice(0, 2000);
    ({ rows } = await query(
      `UPDATE applicants SET coach_note = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLUMNS}`, [id, note]));
  } else {
    return res.status(400).json({ error: 'nothing_to_change' });
  }

  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json(toJson(rows[0]));
}

async function archive(req, res, id) {
  const { rows } = await query(
    'SELECT name FROM applicants WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });

  const norm = (v) => clean(v, 200).toLowerCase();
  if (norm((req.body || {}).confirmName) !== norm(rows[0].name)) {
    return res.status(400).json({ error: 'name_mismatch',
      message: 'El nombre no coincide. Escríbelo igual que aparece en la ficha.' });
  }

  await query('UPDATE applicants SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);
  return res.status(200).json({ ok: true });
}
