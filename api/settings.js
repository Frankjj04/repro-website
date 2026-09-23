/* What the coach types on the admin page and the invitation email reads back.

   GET /api/settings   the payment details, plus what is still missing
   PUT /api/settings   { payment } — saves them
   GET /api/settings?payments=1   every payment Stripe has told us about,
                                  newest first, with the player it matched

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
    `SELECT p.id, p.applicant_id, p.amount_text, p.payer_email, p.payer_name, p.created_at,
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
  }));
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
    if (req.method === 'PUT') {
      const payment = await savePayment((req.body || {}).payment);
      return res.status(200).json({ payment, missing: missingDetails(payment), detailsMissing: detailsGaps(payment) });
    }
  } catch (err) {
    console.error('settings failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
