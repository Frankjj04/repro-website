/* POST /api/resend — Resend telling us what happened to an email we sent:
   delivered, delayed, bounced or marked as spam.

   Not behind the coach's password: Resend cannot log in. What protects it is
   the signature — every message is signed with RESEND_WEBHOOK_SECRET, and one
   that does not match is refused before anything is read or written. */

import { query, isConfigured } from '../lib/db.js';
import { rawBody } from '../lib/raw-body.js';
import { verifyResend, applyEvent } from '../lib/mail-status.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'not_configured' });

  const raw = await rawBody(req);
  const event = verifyResend(raw, req.headers, secret);
  if (!event) {
    // Size and shape only — enough to tell an empty body from a wrong secret
    // (the Stripe webhook's wrong secret went unnoticed a whole day).
    const ts = Number((req.headers || {})['svix-timestamp']);
    console.warn('resend bad_signature', JSON.stringify({
      bytes: raw.length,
      headers: ['svix-id', 'svix-timestamp', 'svix-signature'].filter((k) => (req.headers || {})[k]),
      ageSeconds: Number.isFinite(ts) ? Math.floor(Date.now() / 1000) - ts : null,
      secret: { whsec: secret.startsWith('whsec_'), length: secret.length },
    }));
    return res.status(400).json({ error: 'bad_signature' });
  }
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });

  try {
    return res.status(200).json({ received: true, ...(await applyEvent(query, event)) });
  } catch (err) {
    // A 500 makes Resend try again later.
    console.error('resend event failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
