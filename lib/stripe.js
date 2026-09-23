/* Stripe, without the Stripe library: the only two things this site does with
   it are (1) put the player's id on the payment link so a payment can be tied
   back to them, and (2) check that a "someone paid" message really came from
   Stripe before believing it.

   STRIPE_WEBHOOK_SECRET (whsec_…) is what turns (2) on. It is shown once in
   the coach's Stripe dashboard when the webhook is created. */

import { createHmac, timingSafeEqual } from 'node:crypto';

/* The reference Stripe carries from the payment link to the payment. Letters,
   digits, dashes and underscores only — Stripe's own rule. */
const PREFIX = 'bp-';

export const refFor = (id) => PREFIX + Number(id);

export function idFromRef(ref) {
  const m = /^bp-(\d{1,12})$/.exec(String(ref || ''));
  return m ? Number(m[1]) : null;
}

/* The coach's shared Stripe link, made personal for one player. Only a Stripe
   link gets the reference: anything else is passed through untouched. */
export function checkoutLink(payLink, applicantId) {
  if (!payLink) return '';
  let u;
  try { u = new URL(payLink); } catch { return payLink; }
  if (!/(^|\.)stripe\.com$/.test(u.hostname) || !applicantId) return payLink;
  u.searchParams.set('client_reference_id', refFor(applicantId));
  return u.href;
}

/* Returns the parsed event when the Stripe-Signature header matches the raw
   body, null otherwise. The body must be the exact bytes Stripe sent — a
   re-serialised JSON object never matches. Messages older than five minutes
   are refused so a captured one cannot be replayed later. */
export function verifyEvent(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || !header || rawBody == null) return null;
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);

  let t = null;
  const sigs = [];
  for (const part of String(header).split(',')) {
    const [k, v] = part.split('=', 2).map((x) => (x || '').trim());
    if (k === 't') t = Number(v);
    else if (k === 'v1' && v) sigs.push(v);
  }
  if (!Number.isFinite(t) || !sigs.length) return null;
  if (Math.abs(nowSeconds - t) > 300) return null;

  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest();
  const ok = sigs.some((s) => {
    const got = Buffer.from(s, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) return null;

  try { return JSON.parse(raw); } catch { return null; }
}

/* Only for tests and for trying the webhook by hand. */
export function signForTest(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

/* "$365" for whole amounts, "$365.50" otherwise. Stripe sends cents. */
export function formatAmount(cents, currency) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '';
  const cur = String(currency || 'usd').toUpperCase();
  const whole = n % 100 === 0;
  const num = (n / 100).toFixed(whole ? 0 : 2);
  return cur === 'USD' ? '$' + num : num + ' ' + cur;
}
