/* POST /api/stripe — Stripe's message that somebody paid.

   Not behind the coach's password: Stripe cannot log in. What protects it is
   the signature — every message is signed with STRIPE_WEBHOOK_SECRET, and one
   that does not match is refused before anything is read or written. So
   nobody can mark a player as paid by calling this address themselves.

   On a real payment: the payment is recorded, the player's card shows
   "💰 Pagado", and the details email (venue, time, what to bring) goes out
   when the coach has filled them in. */

import { query, isConfigured } from '../lib/db.js';
import { verifyEvent } from '../lib/stripe.js';
import { rawBody } from '../lib/raw-body.js';
import { recordCheckout, sendDetails } from '../lib/payments.js';
import { loadPayment } from '../lib/settings.js';
import { isEmailConfigured, sendEmail } from '../lib/email.js';
import { FROM, REPLY_TO } from '../js/invite-config.js';
import { toJson, COLUMNS } from './applicants.js';

// The signature is over the exact bytes Stripe sent, so the body must not be
// parsed into an object first.
export const config = { api: { bodyParser: false } };

const HANDLED = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'not_configured' });

  const raw = await rawBody(req);
  const sigHeader = (req.headers || {})['stripe-signature'];
  const event = verifyEvent(raw, sigHeader, secret);
  if (!event) {
    // Enough to tell an empty body from a wrong secret, and nothing that could
    // be used to forge a message: no secret, no signature, no payment data.
    const t = Number((/(?:^|,)t=(\d+)/.exec(sigHeader || '') || [])[1]);
    console.warn('stripe bad_signature', JSON.stringify({
      bytes: raw.length,
      contentType: (req.headers || {})['content-type'] || null,
      header: sigHeader ? { t: Number.isFinite(t), v1: /(?:^|,)v1=/.test(sigHeader) } : null,
      ageSeconds: Number.isFinite(t) ? Math.floor(Date.now() / 1000) - t : null,
      secret: { whsec: secret.startsWith('whsec_'), length: secret.length, trimmed: secret === secret.trim() },
    }));
    return res.status(400).json({ error: 'bad_signature' });
  }

  // Anything else Stripe may send is acknowledged and ignored.
  if (!HANDLED.has(event.type)) return res.status(200).json({ received: true, ignored: event.type });
  // A test event (from Stripe's "send test event", or test mode) proves the
  // connection works; it must never land in the coach's real payments list.
  if (event.livemode === false) return res.status(200).json({ received: true, test: true });
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });

  const session = (event.data || {}).object || {};
  let result;
  try {
    result = await recordCheckout(session, { query });
  } catch (err) {
    // A 500 makes Stripe try again later, which is what we want here.
    console.error('stripe record failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }

  // The payment is safe from here on. The email is a courtesy on top: if it
  // fails, Stripe must not retry (the payment would not be recorded twice,
  // but there is nothing to gain), and the coach can resend from the card.
  if (result.recorded && result.applicantId && isEmailConfigured()) {
    try {
      const { rows } = await query(`SELECT ${COLUMNS} FROM applicants WHERE id = $1`, [result.applicantId]);
      const a = rows.length ? toJson(rows[0]) : null;
      if (a && !a.detailsSentAt) {
        const settings = await loadPayment();
        result.details = await sendDetails(a, {
          query, settings, send: sendEmail, from: FROM, replyTo: REPLY_TO,
          extraTo: result.payerEmail ? [result.payerEmail] : [],
        });
      }
    } catch (err) {
      console.error('details email failed:', err);
      result.details = { error: String(err.message || err) };
    }
  }

  return res.status(200).json({ received: true, ...result });
}
