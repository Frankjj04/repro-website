/* The coach's share links. All behind the password.

   GET    /api/shares           every link, newest first
   POST   /api/shares           { ids, recipient, days } → a new link
   DELETE /api/shares?id=N      turn a link off (it stays in the list) */

import { randomBytes } from 'node:crypto';
import { query, isConfigured } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { clean } from '../lib/validate.js';
import { SHARE_LINK_DAYS } from '../js/registro-config.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    if (req.method === 'GET') return await list(res);
    if (req.method === 'POST') return await create(req, res);
    if (req.method === 'DELETE') return await revoke(req, res);
  } catch (err) {
    console.error('shares failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}

function toJson(r) {
  return {
    id: Number(r.id),
    token: r.token,
    recipient: r.recipient,
    count: r.applicant_ids.length,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    views: r.views,
    lastViewedAt: r.last_viewed_at,
  };
}

async function list(res) {
  const { rows } = await query('SELECT * FROM shares ORDER BY created_at DESC LIMIT 200');
  return res.status(200).json(rows.map(toJson));
}

async function create(req, res) {
  const b = req.body || {};
  const recipient = clean(b.recipient, 120);
  if (!recipient) return res.status(400).json({ error: 'recipient',
    message: 'Escribe para quién es el link (club, scout o agencia).' });

  const days = Number(b.days);
  if (!SHARE_LINK_DAYS.includes(days)) return res.status(400).json({ error: 'days' });

  const asked = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (!asked.length) return res.status(400).json({ error: 'ids', message: 'No hay jugadores para compartir.' });

  // Only players who gave permission and are not archived go in — whatever the
  // page sent. The rest are reported back so the coach knows who was left out.
  const { rows: ok } = await query(
    `SELECT id FROM applicants WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL AND consent_share = true`,
    [asked]);
  const ids = ok.map((r) => Number(r.id));
  if (!ids.length) return res.status(400).json({ error: 'no_consent',
    message: 'Ninguno de estos jugadores autorizó compartir su información.' });

  const token = randomBytes(32).toString('base64url');
  const { rows } = await query(
    `INSERT INTO shares (token, recipient, applicant_ids, expires_at)
     VALUES ($1, $2, $3::bigint[], NOW() + make_interval(days => $4)) RETURNING *`,
    [token, recipient, ids, days]);

  return res.status(201).json({ ...toJson(rows[0]), skipped: asked.length - ids.length });
}

async function revoke(req, res) {
  const id = Number((req.query || {}).id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'bad_id' });
  const { rows } = await query(
    'UPDATE shares SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1 RETURNING *', [id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json(toJson(rows[0]));
}
