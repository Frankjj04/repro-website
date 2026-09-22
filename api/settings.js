/* What the coach types on the admin page and the invitation email reads back.

   GET /api/settings   the payment details, plus what is still missing
   PUT /api/settings   { payment } — saves them

   Behind the password, like everything else on the admin page: these are the
   family's payment instructions, and they are nobody else's business. */

import { isConfigured } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { loadPayment, savePayment, missingDetails } from '../lib/settings.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    if (req.method === 'GET') {
      const payment = await loadPayment();
      return res.status(200).json({ payment, missing: missingDetails(payment) });
    }
    if (req.method === 'PUT') {
      const payment = await savePayment((req.body || {}).payment);
      return res.status(200).json({ payment, missing: missingDetails(payment) });
    }
  } catch (err) {
    console.error('settings failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
