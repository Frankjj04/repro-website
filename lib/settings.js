/* Settings the coach types himself, kept in the database.

   Payment details do not belong in a file: every file in this project is
   served to the public (try bepro.futbol/js/registro-config.js), so a Zelle
   account written in one would be readable by anybody. These live behind the
   password instead, and the coach can change a price without a deploy.

   Prose that a family reads — the deadline and what to bring —
   is kept in both languages. Names and numbers that read the same either way —
   "Zelle", an account, a venue, "9:00 AM", "$365" — are kept once. */

import { query } from './db.js';
import { clean } from './validate.js';
import { EVENTS } from '../js/registro-config.js';

export const EMPTY = {
  // No general price: each date costs what it costs, and a number needs no
  // translating. It lives in logistics[event].price.
  methods:  [],                    // [{ label, detail }]
  deadline: { es: '', en: '' },
  bring:    { es: [], en: [] },
  logistics: {},                   // { [eventId]: { venue, time, price, payLink } }
};

const MAX_METHODS = 6;
const MAX_BRING = 10;

const pair = (v) => ({ es: clean(v && v.es, 200), en: clean(v && v.en, 200) });

/* Trusted only after this: the coach's typing goes straight into an email. */
export function cleanPayment(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {
    deadline: pair(r.deadline),
    methods: (Array.isArray(r.methods) ? r.methods : []).slice(0, MAX_METHODS)
      .map((m) => ({ label: clean(m && m.label, 60), detail: clean(m && m.detail, 200) }))
      .filter((m) => m.label || m.detail),
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
      time: clean(l.time, 80),
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
  const links = EVENTS.filter((e) => (p.logistics[e.id] || {}).payLink).length;
  for (const e of EVENTS) {
    if (!(p.logistics[e.id] || {}).price) out.push('el costo del ' + (e.dates.es || e.id));
  }
  // Either a checkout link on every date, or a way to pay written out. One is
  // enough; neither is not.
  if (!p.methods.length && links < EVENTS.length) {
    out.push('cómo se paga (el link de pago de cada fecha, o los datos para transferir)');
  }
  if (!p.deadline.es) out.push('la fecha límite de pago');
  for (const e of EVENTS) {
    const l = p.logistics[e.id] || {};
    if (!l.venue || !l.time) out.push('el lugar y la hora del ' + (e.dates.es || e.id));
  }
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
