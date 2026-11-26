/* What the coach types on the admin page and the invitation email reads back.

   GET /api/settings   the payment details, plus what is still missing
   PUT /api/settings   { payment } — saves them
   GET /api/settings?payments=1   every payment Stripe has told us about,
                                  newest first, with the player it matched
   PATCH /api/settings?payment=N  { applicantId } — the coach ties a payment
                                  nobody could match to a player; { applicantId: null }
                                  undoes one he tied himself

   Behind the password, like everything else on the admin page: these are the
   family's payment instructions, and they are nobody else's business. */

import { isConfigured, query } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { loadPayment, savePayment, missingDetails } from '../lib/settings.js';
import { detailsMissing } from '../lib/details.js';
import { EVENTS } from '../js/registro-config.js';

/* Dates that could not get the after-payment email yet, for the coach. */
const detailsGaps = (payment) => EVENTS
  .map((e) => ({ e, miss: detailsMissing(payment, e.id) }))
  .filter((x) => x.miss.length)
  .map((x) => x.miss.join(' y ') + ' del ' + (x.e.dates.es || x.e.id));

async function listPayments() {
  const { rows } = await query(
    `SELECT p.id, p.applicant_id, p.amount_text, p.payer_email, p.payer_name, p.created_at, p.assigned_by_hand,
            a.name AS applicant_name, a.event AS applicant_event
       FROM payments p LEFT JOIN applicants a ON a.id = p.applicant_id
      ORDER BY p.created_at DESC LIMIT 500`);
  return rows.map((r) => ({
    id: Number(r.id),
    applicantId: r.applicant_id == null ? null : Number(r.applicant_id),
    applicantName: r.applicant_name || '',
    event: r.applicant_event || '',
    amount: r.amount_text,
    payerEmail: r.payer_email,
    payerName: r.payer_name,
    createdAt: r.created_at,
    byHand: Boolean(r.assigned_by_hand),
  }));
}

/* Ties an unmatched payment to a player, or unties one tied by hand. Each is
   one statement, so the payment and the player's "paid" mark always agree. */
async function assignPayment(paymentId, applicantId) {
  if (applicantId == null) {
    const { rows } = await query(
      `WITH old AS (SELECT applicant_id FROM payments WHERE id = $1 AND assigned_by_hand),
            p AS (UPDATE payments SET applicant_id = NULL, assigned_by_hand = FALSE
                   WHERE id = $1 AND assigned_by_hand RETURNING id)
       SELECT (SELECT COUNT(*) FROM p)::int AS undone,
              (SELECT applicant_id FROM old) AS applicant_id`, [paymentId]);
    if (!rows[0].undone) return { error: 'Ese pago no se asignó a mano.' };
    // Only clear "paid" when no other payment covers that player.
    await query(
      `UPDATE applicants SET paid_at = NULL, paid_amount = '', updated_at = NOW()
        WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM payments WHERE applicant_id = $1)`, [rows[0].applicant_id]);
    return { ok: true };
  }
  const { rows } = await query(
    `WITH p AS (
       UPDATE payments SET applicant_id = $2, assigned_by_hand = TRUE
        WHERE id = $1 AND applicant_id IS NULL
          AND EXISTS (SELECT 1 FROM applicants WHERE id = $2 AND deleted_at IS NULL)
        RETURNING amount_text)
     UPDATE applicants SET paid_at = COALESCE(paid_at, NOW()),
                           paid_amount = (SELECT amount_text FROM p), updated_at = NOW()
      WHERE id = $2 AND EXISTS (SELECT 1 FROM p) RETURNING id`, [paymentId, applicantId]);
  return rows.length ? { ok: true } : { error: 'No se pudo: el pago ya tiene jugador o ese jugador ya no existe.' };
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    if (req.method === 'GET' && (req.query || {}).payments) {
      return res.status(200).json({ payments: await listPayments() });
    }
    if (req.method === 'GET') {
      const payment = await loadPayment();
      return res.status(200).json({ payment, missing: missingDetails(payment), detailsMissing: detailsGaps(payment) });
    }
    if (req.method === 'PATCH' && (req.query || {}).payment) {
      const pid = Number(req.query.payment);
      const raw = (req.body || {}).applicantId;
      const aid = raw == null ? null : Number(raw);
      if (!Number.isInteger(pid) || pid < 1 || (aid !== null && (!Number.isInteger(aid) || aid < 1))) {
        return res.status(400).json({ error: 'bad_request', message: 'Datos no válidos.' });
      }
      const out = await assignPayment(pid, aid);
      if (out.error) return res.status(409).json({ error: 'conflict', message: out.error });
      return res.status(200).json({ ok: true, payments: await listPayments() });
    }
    if (req.method === 'PUT') {
      const payment = await savePayment((req.body || {}).payment);
      return res.status(200).json({ payment, missing: missingDetails(payment), detailsMissing: detailsGaps(payment) });
    }
  } catch (err) {
    console.error('settings failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }

  res.setHeader('Allow', 'GET, PUT, PATCH');
  return res.status(405).json({ error: 'method_not_allowed' });
}
