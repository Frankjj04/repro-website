/* Did the email reach them? Resend tells us afterwards.

   Every invitation and details email the site sends is written down here with
   Resend's id for it. Resend then calls /api/resend when that email is
   delivered, delayed or bounced, and the player's card shows it — so a typo'd
   address is caught the same day instead of on event day.

   Opens are deliberately not tracked: it needs a hidden image in the email,
   iPhones make it unreliable, and many of these families are minors. */

import { createHmac, timingSafeEqual } from 'node:crypto';

// Resend's event → what we store. Anything else is acknowledged and ignored.
export const EVENT_STATUS = {
  'email.delivery_delayed': 'delayed',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  // Both mean it never reached them, same as a bounce for the coach:
  // suppressed = Resend refused because this address bounced or complained
  // before; failed = the send itself failed.
  'email.suppressed': 'bounced',
  'email.failed': 'bounced',
};

// Events can arrive out of order; a later, weaker one never overwrites a
// stronger one (a "delayed" that shows up after "delivered" changes nothing).
export const RANK = { sent: 0, delayed: 1, delivered: 2, bounced: 3, complained: 3 };
const RANK_SQL = `CASE status WHEN 'sent' THEN 0 WHEN 'delayed' THEN 1 WHEN 'delivered' THEN 2 ELSE 3 END`;

const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

/* Writes down one email that just went out. `result` is what sendEmail
   returned. Never throws: the email already left, and a missing row only
   means the card cannot show its delivery. */
export async function logSent(query, { result, applicantId, kind, to }) {
  const id = result && typeof result === 'object' ? clean(result.id, 100) : '';
  if (!id || !applicantId) return;
  try {
    await query(
      `INSERT INTO emails (resend_id, applicant_id, kind, recipient) VALUES ($1, $2, $3, $4)
       ON CONFLICT (resend_id) DO NOTHING`,
      [id, applicantId, kind, clean(to, 320)]);
  } catch (err) {
    console.error('email log failed:', err);
  }
}

/* Resend signs its webhooks the Svix way: HMAC-SHA256 over
   "<svix-id>.<svix-timestamp>.<body>", keyed with the base64 part of the
   whsec_ secret, sent as space-separated "v1,<base64>" entries. */
export function verifyResend(rawBody, headers, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const h = headers || {};
  const id = h['svix-id'];
  const ts = Number(h['svix-timestamp']);
  const sigHeader = h['svix-signature'];
  if (!secret || !id || !sigHeader || rawBody == null || !Number.isFinite(ts)) return null;
  if (Math.abs(nowSeconds - ts) > 300) return null;

  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  if (!key.length) return null;
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest();

  const ok = String(sigHeader).split(' ').some((part) => {
    const [version, sig] = part.split(',', 2);
    if (version !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) return null;

  try { return JSON.parse(raw); } catch { return null; }
}

/* Only for tests and for trying the webhook by hand. */
export function signResendForTest(rawBody, secret, id = 'msg_test', ts = Math.floor(Date.now() / 1000)) {
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': 'v1,' + sig };
}

/* Applies one verified Resend event. Returns what happened, for the response. */
export async function applyEvent(query, event) {
  const status = EVENT_STATUS[event && event.type];
  if (!status) return { ignored: (event && event.type) || 'unknown' };
  const d = event.data || {};
  const id = clean(d.email_id, 100);
  if (!id) return { ignored: 'no_email_id' };

  // Resend explains why in data.bounce / data.suppressed / data.failed; keep
  // the short reason for the coach.
  const why = d.bounce || d.suppressed || d.failed || {};
  const detail = status === 'bounced'
    ? clean(why.message || why.reason || why.subType || why.type || (event.type === 'email.suppressed' ? 'suppressed' : ''), 300)
    : '';

  const { rows } = await query(
    `UPDATE emails SET status = $2, status_detail = $3, status_at = NOW()
      WHERE resend_id = $1 AND (${RANK_SQL}) <= $4
      RETURNING applicant_id`,
    [id, status, detail, RANK[status]]);
  // No row: an email sent before this existed, a test, or an older event.
  return rows.length ? { updated: status, applicantId: Number(rows[0].applicant_id) } : { unchanged: status };
}
