/* What happens when Stripe says somebody paid.

   Kept apart from the endpoint, with the database and the mailer passed in, so
   the tests can walk through every case without Stripe or Postgres. */

import { idFromRef, formatAmount } from './stripe.js';
import { buildDetails, detailsMissing, recipients } from './details.js';

const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

/* Which player a payment belongs to. The reference on the link wins; without
   one (someone paid from a link that was not personalised), an email that
   matches exactly one invited player is accepted. Anything else stays
   unmatched and the coach sees it in the payments list. */
async function findApplicant(session, query) {
  const byRef = idFromRef(session.client_reference_id);
  if (byRef) {
    const { rows } = await query('SELECT id FROM applicants WHERE id = $1', [byRef]);
    if (rows.length) return byRef;
  }
  const email = clean(session.customer_details && session.customer_details.email, 320).toLowerCase();
  if (!email) return null;
  const { rows } = await query(
    `SELECT id FROM applicants
      WHERE deleted_at IS NULL AND status = 'selected'
        AND (lower(email) = $1 OR lower(parent_email) = $1)`, [email]);
  return rows.length === 1 ? Number(rows[0].id) : null;
}

/* Records one finished Checkout. Safe to call twice with the same session —
   Stripe retries — the second call changes nothing and sends nothing. */
export async function recordCheckout(session, { query }) {
  if (!session || !session.id) return { skipped: 'no_session' };
  // Card payments arrive as paid; bank debits can finish "unpaid" and settle
  // later with their own event, which comes back through here.
  if (session.payment_status !== 'paid') return { skipped: 'not_paid' };

  const applicantId = await findApplicant(session, query);
  const cd = session.customer_details || {};
  const amount = formatAmount(session.amount_total, session.currency);

  const { rows } = await query(
    `INSERT INTO payments (stripe_session, applicant_id, amount_cents, currency, amount_text,
                           payer_email, payer_name, payment_link, reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (stripe_session) DO NOTHING
     RETURNING id`,
    [clean(session.id, 255), applicantId, Number(session.amount_total) || 0,
     clean(session.currency, 10), amount, clean(cd.email, 320), clean(cd.name, 200),
     clean(session.payment_link, 255), clean(session.client_reference_id, 200)]);
  if (!rows.length) return { duplicate: true, applicantId };

  if (applicantId) {
    await query(
      `UPDATE applicants SET paid_at = COALESCE(paid_at, NOW()), paid_amount = $2, updated_at = NOW()
        WHERE id = $1`, [applicantId, amount]);
  }
  return { recorded: true, applicantId, amount, payerEmail: clean(cd.email, 320) };
}

/* Sends the details email to one player. Returns who it went to, or why it
   could not go. Never throws on a missing detail: the payment is already
   recorded, and the coach can send it from the card once he fills it in. */
export async function sendDetails(a, { query, settings, send, from, replyTo, extraTo = [] }) {
  const missing = detailsMissing(settings, a.event);
  if (missing.length) return { sent: [], missing };

  const mail = buildDetails(a, { settings, amount: a.paidAmount });
  const seen = new Set();
  const to = [...recipients(a), ...extraTo]
    .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));

  for (const address of to) {
    await send({ from, to: address, replyTo, subject: mail.subject, html: mail.html, text: mail.text });
  }
  await query(
    `UPDATE applicants SET details_sent_at = NOW(), details_to = $2, updated_at = NOW() WHERE id = $1`,
    [a.id, to.join(', ')]);
  return { sent: to, missing: [] };
}
