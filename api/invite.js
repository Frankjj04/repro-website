/* The invitation email for one player, behind the coach's password.

   GET  /api/invite?id=N   what the email will say — nothing is sent, nothing
                           is written down. The coach reads this before deciding.
   POST /api/invite?id=N   actually sends it, and records that it went out.

   With &kind=details, the same two steps for the second email: venue, time and
   what to bring. Stripe sends that one by itself when a family pays; this is
   for resending it, or for a family that paid another way.

   With &kind=wa, the invitation as a WhatsApp / text message: GET gives the
   text and the number, POST only notes that the coach opened it (he sends it
   from his own phone — nothing leaves from here).

   Sending is deliberately a second, separate step from marking somebody
   "Invitado": a status can be undone with another tap, an email cannot. */

import { randomBytes } from 'node:crypto';
import { query, isConfigured } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { buildInvite, asksFor, buildWhatsApp, waDigits } from '../lib/invite.js';
import { isEmailConfigured, sendEmail } from '../lib/email.js';
import { FROM, REPLY_TO, PARENT_LINK_DAYS } from '../js/invite-config.js';
import { loadPayment, missingDetails } from '../lib/settings.js';
import { toJson, COLUMNS } from './applicants.js';
import { buildDetails, detailsMissing, recipients } from '../lib/details.js';
import { sendDetails } from '../lib/payments.js';
import { logSent } from '../lib/mail-status.js';

const SITE = (process.env.SITE_URL || 'https://bepro.futbol').replace(/\/+$/, '');

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
  res.setHeader('Cache-Control', 'private, no-store');

  const id = Number((req.query || {}).id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'bad_id' });

  const kind = (req.query || {}).kind;
  const details = kind === 'details';
  try {
    if (kind === 'wa') {
      if (req.method === 'GET') return await previewWa(res, id);
      if (req.method === 'POST') return await noteWa(res, id);
    }
    if (req.method === 'GET') return await (details ? previewDetails : preview)(res, id);
    if (req.method === 'POST') return await (details ? sendDetailsNow : send)(res, id);
  } catch (err) {
    console.error('invite failed:', err);
    return res.status(500).json({ error: 'server_error', message: String(err.message || err) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function load(id) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM applicants WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return rows.length ? toJson(rows[0]) : null;
}

/* Everything standing between the coach and a send, in the order he can fix
   them. Empty means the button is safe to press. */
export function blockers(a, payment) {
  const out = [];
  // The invitation says "pay for your spot" — sent to a family that already
  // paid, it asks them to pay twice. What they need now is the details email.
  if (a.paidAt) {
    out.push('Este jugador ya pagó — no le mandes otra invitación, le pediría pagar otra vez. ' +
      'Si le faltan los detalles, usa “Reenviar detalles”.');
    return out;
  }
  if (a.status !== 'selected') out.push('Marca al jugador como Invitado primero.');
  for (const m of missingDetails(payment)) out.push('Falta ' + m + ' — ponlo en “Datos del pago”.');
  if (!isEmailConfigured()) out.push('Falta conectar el servicio de correo (RESEND_API_KEY).');
  if (!a.email) out.push('Este jugador no tiene email.');
  return out;
}

async function preview(res, id) {
  const a = await load(id);
  if (!a) return res.status(404).json({ error: 'not_found' });

  const payment = await loadPayment();
  const asks = asksFor(a);
  // A real token is only minted when the mail is actually sent; the preview
  // shows the shape of the link so the coach knows what the parent receives.
  const parentLink = asks.parent ? SITE + '/permiso.html?t=' + '·'.repeat(12) : '';
  const mail = buildInvite(a, { parentLink, settings: payment });

  return res.status(200).json({
    to: a.email,
    parentEmail: a.parentEmail || '',
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    lang: mail.lang,
    asks: mail.asks,
    invitedAt: a.invitedAt,
    inviteCount: a.inviteCount,
    blockers: blockers(a, payment),
  });
}

async function send(res, id) {
  const a = await load(id);
  if (!a) return res.status(404).json({ error: 'not_found' });

  const payment = await loadPayment();
  const stop = blockers(a, payment);
  if (stop.length) {
    return res.status(400).json({ error: 'not_ready', blockers: stop, message: stop.join(' ') });
  }

  const asks = asksFor(a);
  let parentLink = '';
  if (asks.parent) {
    // One live link per player: minting a new one replaces the old.
    const token = randomBytes(32).toString('base64url');
    await query(
      `UPDATE applicants SET parent_token = $2,
              parent_token_expires_at = NOW() + make_interval(days => $3), updated_at = NOW()
        WHERE id = $1`, [id, token, PARENT_LINK_DAYS]);
    parentLink = SITE + '/permiso.html?t=' + token;
  }

  const mail = buildInvite(a, { parentLink, settings: payment });

  // Under 13 the parent is the one who has to read this, so they get a copy
  // whenever we know their address.
  const to = [a.email, ...(asks.parent && a.parentEmail ? [a.parentEmail] : [])];
  try {
    for (const address of to) {
      const result = await sendEmail({ from: FROM, to: address, replyTo: REPLY_TO,
        subject: mail.subject, html: mail.html, text: mail.text });
      await logSent(query, { result, applicantId: a.id, kind: 'invite', to: address });
    }
  } catch (err) {
    return res.status(502).json({ error: 'email_failed', message: String(err.message || err) });
  }

  const { rows } = await query(
    `UPDATE applicants SET invited_at = NOW(), invite_count = invite_count + 1,
            invite_to = $2, updated_at = NOW()
      WHERE id = $1 RETURNING ${COLUMNS}`, [id, to.join(', ')]);

  return res.status(200).json({ sent: to, applicant: toJson(rows[0]) });
}

/* ---------- the details email ---------- */

function detailBlockers(a, settings) {
  const out = [];
  const miss = detailsMissing(settings, a.event);
  if (miss.length) out.push('Falta ' + miss.join(' y ') + ' de esta fecha — ponlo en “Datos del pago”.');
  if (!isEmailConfigured()) out.push('Falta conectar el servicio de correo (RESEND_API_KEY).');
  if (!a.email) out.push('Este jugador no tiene email.');
  return out;
}

async function previewDetails(res, id) {
  const a = await load(id);
  if (!a) return res.status(404).json({ error: 'not_found' });
  const settings = await loadPayment();
  const mail = buildDetails(a, { settings, amount: a.paidAmount });
  return res.status(200).json({
    to: recipients(a).join(' · '),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    lang: mail.lang,
    asks: { parent: false },
    // Not a blocker: a family that paid in cash still needs the venue.
    notice: a.paidAt ? '' : 'Este jugador no tiene un pago registrado en Stripe. Mándalo solo si ya pagó de otra forma.',
    blockers: detailBlockers(a, settings),
  });
}

async function sendDetailsNow(res, id) {
  const a = await load(id);
  if (!a) return res.status(404).json({ error: 'not_found' });
  const settings = await loadPayment();
  const stop = detailBlockers(a, settings);
  if (stop.length) return res.status(400).json({ error: 'not_ready', blockers: stop, message: stop.join(' ') });

  let out;
  try {
    out = await sendDetails(a, { query, settings, send: sendEmail, from: FROM, replyTo: REPLY_TO });
  } catch (err) {
    return res.status(502).json({ error: 'email_failed', message: String(err.message || err) });
  }
  const { rows } = await query(`SELECT ${COLUMNS} FROM applicants WHERE id = $1`, [id]);
  return res.status(200).json({ sent: out.sent, applicant: toJson(rows[0]) });
}

/* ---------- the invitation by WhatsApp / text message ---------- */

export function waBlockers(a, settings) {
  if (a.paidAt) return ['Este jugador ya pagó — no le mandes el link de pago otra vez.'];
  const out = [];
  if (a.status !== 'selected') out.push('Marca al jugador como Invitado primero.');
  const log = (settings.logistics || {})[a.event] || {};
  if (!log.payLink) out.push('Falta el link de pago de esta fecha — ponlo en “Datos del pago”.');
  if (waDigits(a.phone).length < 7) out.push('Este jugador no tiene un teléfono que sirva.');
  return out;
}

async function previewWa(res, id) {
  const a = await load(id);
  if (!a) return res.status(404).json({ error: 'not_found' });
  const settings = await loadPayment();
  const msg = buildWhatsApp(a, { settings });
  return res.status(200).json({
    text: msg.text,
    phone: waDigits(a.phone),
    lang: msg.lang,
    // Under 13 with no permission yet: the permission link only exists in the email.
    notice: msg.asks.parent && !a.invitedAt
      ? 'Es menor de 13 y falta el permiso del tutor. Mándale también la invitación por correo: ahí va el link del permiso.'
      : '',
    blockers: waBlockers(a, settings),
  });
}

async function noteWa(res, id) {
  const { rows } = await query(
    `UPDATE applicants SET wa_sent_at = NOW(), wa_count = wa_count + 1, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLUMNS}`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json({ applicant: toJson(rows[0]) });
}
