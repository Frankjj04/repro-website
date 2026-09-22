/* The parent's own permission page — the only part of the registration that
   a parent reaches without the coach.

   GET  /api/permiso?t=TOKEN   who this link is about, so the page can show a
                               name and an age. Nothing else about the player.
   POST /api/permiso           { t, who, name, email } — records the answer.

   The link is a secret: 32 random bytes. It is checked by shape before it ever
   reaches the database, it expires, and it is cleared the moment it is used,
   so a forwarded link cannot be replayed. */

import { query, isConfigured } from '../lib/db.js';
import { clean, ageOn } from '../lib/validate.js';
import { EVENTS } from '../js/registro-config.js';

const isToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

const LIVE = `SELECT id, name, dob, event, form_lang, parent_confirmed_at
  FROM applicants
  WHERE parent_token = $1 AND deleted_at IS NULL
    AND parent_token_expires_at > NOW()`;

export default async function handler(req, res) {
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
  // Never cached, never indexed: this page is about one child.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');

  try {
    if (req.method === 'GET') return await show(req, res);
    if (req.method === 'POST') return await record(req, res);
  } catch (err) {
    console.error('permiso failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

const dates = (id, lang) => {
  const e = EVENTS.find((x) => x.id === id);
  return e ? (e.dates[lang] || e.dates.es) : '';
};

async function show(req, res) {
  const t = (req.query || {}).t;
  if (!isToken(t)) return res.status(404).json({ error: 'not_found' });

  const { rows } = await query(LIVE, [t]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });

  const a = rows[0];
  const lang = a.form_lang === 'en' ? 'en' : 'es';
  return res.status(200).json({
    name: a.name,
    age: ageOn(a.dob instanceof Date ? a.dob.toISOString().slice(0, 10) : String(a.dob)),
    event: dates(a.event, lang),
    lang,
    already: Boolean(a.parent_confirmed_at),
  });
}

async function record(req, res) {
  const b = req.body || {};
  if (!isToken(b.t)) return res.status(404).json({ error: 'not_found' });
  if (b.who !== 'parent' && b.who !== 'player') return res.status(400).json({ error: 'who' });

  const { rows } = await query(LIVE, [b.t]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const id = rows[0].id;

  const name = clean(b.name, 100);
  const email = clean(b.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    return res.status(400).json({ error: 'email' });
  }

  if (b.who === 'player') {
    // Honest answer, but not a permission: the coach has to call. The link
    // stays alive so the parent can still give it afterwards.
    await query(
      `UPDATE applicants SET parent_reply = 'player', parent_reply_at = NOW(), updated_at = NOW()
        WHERE id = $1`, [id]);
    return res.status(200).json({ recorded: 'player' });
  }

  if (!name) return res.status(400).json({ error: 'name' });

  // Permission given. The link dies here.
  await query(
    `UPDATE applicants
        SET parent_confirmed_at = NOW(), parent_confirm_source = 'link',
            parent_confirm_name = $2,
            parent_email = CASE WHEN $3 <> '' THEN $3 ELSE parent_email END,
            parent_reply = 'parent', parent_reply_at = NOW(),
            parent_token = NULL, parent_token_expires_at = NULL, updated_at = NOW()
      WHERE id = $1`, [id, name, email]);

  return res.status(200).json({ recorded: 'parent' });
}
