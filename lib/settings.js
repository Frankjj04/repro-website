/* Settings the coach types himself, kept in the database.

   Payment details do not belong in a file: every file in this project is
   served to the public (try bepro.futbol/js/registro-config.js), so a Zelle
   account written in one would be readable by anybody. These live behind the
   password instead, and the coach can change a price without a deploy.

   Prose that a family reads — what to bring —
   is kept in both languages. Names and numbers that read the same either way —
   "Zelle", an account, a venue, "9:00 AM", "$365" — are kept once. */

import { query } from './db.js';
import { clean } from './validate.js';
import { EVENTS } from '../js/registro-config.js';

export const EMPTY = {
  // No general price: each date costs what it costs, and a number needs no
  // translating. It lives in logistics[event].price.
  bring:    { es: [], en: [] },
  logistics: {},                   // { [eventId]: { venue, time, price, payLink } }
};

const MAX_BRING = 10;

/* Trusted only after this: the coach's typing goes straight into an email. */
export function cleanPayment(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {
    bring: {
      es: (Array.isArray(r.bring && r.bring.es) ? r.bring.es : []).slice(0, MAX_BRING)
        .map((b) => clean(b, 120)).filter(Boolean),
      en: (Array.isArray(r.bring && r.bring.en) ? r.bring.en : []).slice(0, MAX_BRING)
        .map((b) => clean(b, 120)).filter(Boolean),
    },
    logistics: {},
  };
  // Only the events that exist: a stale id would never be shown anyway.
  for (const e of EVENTS) {
    const l = (r.logistics || {})[e.id] || {};
    out.logistics[e.id] = {
      venue: clean(l.venue, 160),
      // One line per birth-year group ("2003, 2004, 2005: 9:30 AM").
      time: String(l.time == null ? '' : l.time).split('\n').map((x) => clean(x, 80))
        .filter(Boolean).slice(0, 8).join('\n'),
      // Each date can cost a different amount — they are different events with
      // different clubs watching. A date with no price of its own falls back
      // to the general one.
      price: clean(l.price, 100),
      payLink: payLink(l.payLink),
    };
  }
  return out;
}

/* The checkout link families tap to pay. Only https, and only a link: this one
   goes into an email about money, so anything odd is dropped rather than
   passed along. */
export function payLink(s) {
  const v = clean(s, 300);
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  return u.href;
}

/* What is still missing before an email about money may be sent, named the way
   the coach will recognise it. */
export function missingDetails(p) {
  const out = [];
  // Every date needs its price and its Stripe link: the invitation is a price
  // and a button, nothing else.
  for (const e of EVENTS) {
    const l = p.logistics[e.id] || {};
    const d = e.dates.es || e.id;
    if (!l.price) out.push('el costo del ' + d);
    if (!l.payLink) out.push('el link de pago del ' + d);
  }
  // Venue and time are not needed to invite (coach, 2026-09-23): they go out
  // in the details email once the family pays.
  return out;
}

export const isReady = (p) => missingDetails(p).length === 0;

export async function loadPayment() {
  const { rows } = await query(`SELECT value FROM settings WHERE key = 'payment'`);
  return cleanPayment(rows.length ? rows[0].value : {});
}

export async function savePayment(raw) {
  const value = cleanPayment(raw);
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('payment', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(value)]);
  return value;
}
