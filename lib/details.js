/* The email a family gets once they have paid: where, when and what to bring.

   The coach wanted these kept out of the invitation (2026-09-23) — only people
   who paid get the venue. They are typed on the admin page under
   "Datos del pago" and sent by the Stripe webhook the moment a payment lands,
   or by hand from the player's card. */

import { EMPTY } from './settings.js';
import { esc, eventDates, box, p, button, shell, T as BASE } from './invite.js';
import { WHATSAPP } from '../js/invite-config.js';

const T = {
  es: {
    subject: (d) => `Pago recibido · Detalles del evento · BE PRO Futbol · ${d}`,
    hi: (n) => `Hola ${n},`,
    lead: (d, amt) => `Recibimos tu pago${amt ? ` de <strong>${amt}</strong>` : ''}. <strong>Tu lugar en el evento del ${d} está apartado.</strong> Aquí van los detalles.`,
    where: 'Dónde y a qué hora',
    map: 'Ver en el mapa',
    bring: 'Qué traer',
  },
  en: {
    subject: (d) => `Payment received · Event details · BE PRO Futbol · ${d}`,
    hi: (n) => `Hi ${n},`,
    lead: (d, amt) => `We received your payment${amt ? ` of <strong>${amt}</strong>` : ''}. <strong>Your spot at the ${d} event is confirmed.</strong> Here are the details.`,
    where: 'Where and when',
    map: 'Open in maps',
    bring: 'What to bring',
  },
};

/* What the coach still has to type before this email can go to anyone on
   that date. Named the way he will recognise it. */
export function detailsMissing(settings, eventId) {
  const l = ((settings || EMPTY).logistics || {})[eventId] || {};
  const out = [];
  if (!l.venue) out.push('el lugar');
  if (!l.time) out.push('la hora');
  return out;
}

/* The coach gives each date's check-in by birth year, one line per group:
     2003, 2004, 2005: 9:30 AM
     2006-2008: 11:00 AM
   A player is told only the line with their own birth year. If no line names
   a year (a single time for everybody), the text is shown as typed. */
const TIME_RE = /\b\d{1,2}(?::\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?(?=\s*$)/i;

function yearsIn(s) {
  const out = new Set();
  for (const m of s.matchAll(/\b((?:19|20)\d{2})\s*[-–a]\s*((?:19|20)\d{2})\b/g)) {
    for (let y = Number(m[1]); y <= Number(m[2]) && y - Number(m[1]) < 30; y++) out.add(y);
  }
  for (const m of s.matchAll(/\b(?:19|20)\d{2}\b/g)) out.add(Number(m[0]));
  return out;
}

export function checkInFor(timeText, dob) {
  const lines = String(timeText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const year = Number(String(dob || '').slice(0, 4));
  for (const line of lines) {
    const tm = TIME_RE.exec(line);
    if (!tm) continue;
    if (yearsIn(line.slice(0, tm.index)).has(year)) return tm[0].trim();
  }
  return null;
}

const mapLink = (venue) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(venue);

/* opts.amount — what they paid, already formatted ("$365"), when known. */
export function buildDetails(a, opts = {}) {
  const S = opts.settings || EMPTY;
  const lang = a.formLang === 'en' ? 'en' : 'es';
  const t = T[lang];
  const base = BASE[lang];
  const dates = eventDates(a.event, lang);
  const firstName = String(a.name || '').trim().split(/\s+/)[0] || '';
  const log = (S.logistics || {})[a.event] || {};
  const own = checkInFor(log.time, a.dob);
  const when = own ? 'Check-in: ' + own : String(log.time || '');
  const amount = opts.amount || '';
  const bring = ((S.bring || {})[lang] || []).length ? S.bring[lang] : ((S.bring || {}).es || []);

  const lines = [
    t.hi(firstName), '',
    t.lead(dates, amount).replace(/<[^>]+>/g, ''), '',
    t.where.toUpperCase(), log.venue || '', when, mapLink(log.venue || ''), '',
  ];
  if (bring.length) lines.push(t.bring.toUpperCase(), ...bring.map((b) => '- ' + b), '');
  lines.push(base.doubts(WHATSAPP).replace(/<[^>]+>/g, ''), '', base.bye, base.team);

  const html = shell(lang, t.subject(dates), `
  <tr><td style="padding:22px 24px 4px;">
    ${p(esc(t.hi(firstName)))}
    ${p(t.lead(esc(dates), esc(amount)))}
  </td></tr>
  ${box(t.where,
    p(`<strong>${esc(log.venue)}</strong><br />${esc(when).replace(/\n/g, '<br />')}`) +
    (log.venue ? button(mapLink(log.venue), t.map, '#0A0E2A') : ''), '#FF6B1A')}
  ${bring.length ? box(t.bring,
    `<ul style="margin:0;padding-left:18px;font:400 15px/1.7 Arial,sans-serif;color:#22263A;">${
      bring.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`) : ''}
`);

  return { lang, subject: t.subject(dates), html, text: lines.join('\n') };
}

/* Everyone who should read it: the player, and the parent when we have their
   address — the parent is usually the one who paid. */
export function recipients(a) {
  const out = [a.email];
  if (a.parentEmail && a.parentEmail.toLowerCase() !== String(a.email).toLowerCase()) out.push(a.parentEmail);
  return out.filter(Boolean);
}
