/* The invitation email: what it says, in the player's own language.

   Pure text building — no database, no network — so the admin page can show
   the coach exactly what will be sent before anything leaves, and the tests
   can check every version of it.

   Two things can go in one email: the invitation itself (always) and a request
   for the parent's permission (only when the player is under 13 and nobody has
   given it yet). It never asks for a video: by the time someone is invited,
   the coach has already seen them play (2026-09-24). */

import { EVENTS, CHILD_AGE } from '../js/registro-config.js';
import { ageOn } from './validate.js';
import { WHATSAPP } from '../js/invite-config.js';
import { EMPTY } from './settings.js';
import { checkoutLink } from './stripe.js';

export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const pick = (v, lang) => (v && typeof v === 'object' ? (v[lang] || v.es || '') : String(v || ''));

export const eventDates = (id, lang) => {
  const e = EVENTS.find((x) => x.id === id);
  return e ? pick(e.dates, lang) : id;
};

/* What this particular player still owes us, decided from their own record —
   never from what the coach remembers. */
export function asksFor(a, now = new Date()) {
  const age = ageOn(a.dob, now);
  return {
    parent: age !== null && age < CHILD_AGE && !a.parentConfirmedAt,
  };
}

export const T = {
  es: {
    subject: (d) => `¡Felicidades, fuiste seleccionado! · BE PRO Futbol · ${d}`,
    hi: (n) => `Hola ${n},`,
    lead: (d) => `¡Felicidades! Revisamos tu registro y <strong>fuiste seleccionado</strong> para nuestro evento de scouting del <strong>${d}</strong>. Es tu oportunidad de jugar frente a scouts de clubes profesionales, y nos da mucho gusto contar contigo.`,
    pay_h: 'Tu lugar se aparta con el pago',
    pay_amount: 'Costo',
    pay_after: 'Cuando hagas tu pago te mandamos todos los detalles del evento.',
    pay_close: 'Los registros se cierran cuando se llena el evento.',
    pay_btn: 'Pagar mi lugar',
    pay_btn_note: 'Se abre la página segura de pago (Stripe).',
    parent_h: 'Falta el permiso de tu papá, mamá o tutor',
    parent_p: 'Como el jugador es menor de 13 años, necesitamos que un papá, mamá o tutor nos confirme que está de acuerdo. Es un minuto:',
    parent_btn: 'Dar el permiso',
    doubts: (w) => `¿Dudas? Escríbenos por WhatsApp al <a href="https://wa.me/${w}" style="color:#FF6B1A;">+1 702-831-9474</a>. Contesta este correo y también nos llega.`,
    bye: 'Nos vemos en la cancha.',
    team: 'BE PRO Futbol · Las Vegas, Nevada',
    legal: 'Aviso de privacidad',
    legal2: 'Términos de uso',
  },
  en: {
    subject: (d) => `Congratulations, you've been selected! · BE PRO Futbol · ${d}`,
    hi: (n) => `Hi ${n},`,
    lead: (d) => `Congratulations! We reviewed your registration and <strong>you've been selected</strong> for our scouting event on <strong>${d}</strong>. It's your chance to play in front of scouts from professional clubs, and we're excited to have you.`,
    pay_h: 'Your spot is held once you pay',
    pay_amount: 'Cost',
    pay_after: 'Once you pay, we will send you all the event details.',
    pay_close: 'Registration closes when the event is full.',
    pay_btn: 'Pay for my spot',
    pay_btn_note: 'Opens the secure payment page (Stripe).',
    parent_h: "We still need a parent's permission",
    parent_p: 'The player is under 13, so we need a parent or legal guardian to confirm they agree. It takes a minute:',
    parent_btn: 'Give permission',
    doubts: (w) => `Questions? Message us on WhatsApp at <a href="https://wa.me/${w}" style="color:#FF6B1A;">+1 702-831-9474</a>. Replying to this email reaches us too.`,
    bye: 'See you on the pitch.',
    team: 'BE PRO Futbol · Las Vegas, Nevada',
    legal: 'Privacy notice',
    legal2: 'Terms of use',
  },
};


/* ---------- pieces shared with the details email (lib/details.js) ---------- */

export const box = (title, inner, accent) => `
  <tr><td class="bp-box" style="padding:18px 24px;border-top:1px solid #E6E8EF;">
      <p class="${accent ? 'bp-accent' : 'bp-title'}" style="margin:0 0 8px;font:600 13px/1.4 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${accent || '#0A0E2A'};">${esc(title)}</p>
      ${inner}
    </td></tr>`;

export const p = (s) => `<p class="bp-text" style="margin:0 0 10px;font:400 15px/1.6 Arial,sans-serif;color:#22263A;">${s}</p>`;

export const button = (href, label, color) => `
    <a class="bp-btn" href="${esc(href)}" style="display:inline-block;margin:6px 0 2px;padding:12px 20px;border-radius:8px;background:${color};color:#fff;font:700 14px/1 Arial,sans-serif;text-decoration:none;">${esc(label)}</a>`;

/* Phones in dark mode repaint an email that does not say how it looks in the
   dark — Apple Mail turned the navy header lilac and the button text dark.
   Declaring both schemes and giving the dark one its own colours keeps the
   brand: navy header, white BE, orange PRO, white on the orange button.
   Dates and phone numbers are not turned into links by the phone either. */
const DARK_CSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  a[x-apple-data-detectors], .bp-text a[href^="tel"] { color: inherit !important; text-decoration: none !important; }
  @media (prefers-color-scheme: dark) {
    .bp-bg { background: #05081A !important; }
    .bp-card { background: #0F1535 !important; }
    .bp-head { background: #0A0E2A !important; }
    .bp-be { color: #FFFFFF !important; }
    .bp-box { border-top-color: #232B55 !important; }
    .bp-text { color: #E6E9F5 !important; }
    .bp-text strong { color: #FFFFFF !important; }
    .bp-title { color: #FFFFFF !important; }
    .bp-muted, .bp-muted a { color: #A3ABCB !important; }
    .bp-btn { color: #FFFFFF !important; }
    .bp-btn-navy { background: #26336E !important; }
    .bp-foot { background: #0B1030 !important; }
  }
  [data-ogsc] .bp-card { background: #0F1535 !important; }
  [data-ogsc] .bp-text { color: #E6E9F5 !important; }
  [data-ogsc] .bp-be, [data-ogsc] .bp-btn { color: #FFFFFF !important; }`;

/* The frame every BE PRO email shares: the dark header, the body rows, the
   WhatsApp line and the legal links at the bottom. */
export function shell(lang, title, rows) {
  const t = T[lang];
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
<meta name="color-scheme" content="light dark" /><meta name="supported-color-schemes" content="light dark" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
<title>${esc(title)}</title><style>${DARK_CSS}</style></head>
<body class="bp-bg" style="margin:0;padding:24px 12px;background:#F2F3F7;">
<table role="presentation" cellpadding="0" cellspacing="0" class="bp-card" style="max-width:560px;margin:0 auto;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
  <tr><td class="bp-head" style="padding:22px 24px;background:#0A0E2A;">
    <span class="bp-be" style="font:800 22px/1 Arial,sans-serif;color:#fff;letter-spacing:.04em;">BE<span style="color:#FF6B1A;">PRO</span></span>
    <span style="display:block;margin-top:4px;font:600 10px/1 Arial,sans-serif;letter-spacing:.22em;color:#00D4FF;">EL ECOSISTEMA DEL TALENTO</span>
  </td></tr>
${rows}
  ${box('', p(t.doubts(WHATSAPP)) + p(`${esc(t.bye)}<br /><strong>${esc(t.team)}</strong>`))}
  <tr><td class="bp-foot bp-muted" style="padding:14px 24px 22px;background:#F7F8FB;font:400 12px/1.6 Arial,sans-serif;color:#7A7F96;">
    <a href="https://bepro.futbol/privacidad.html" style="color:#7A7F96;">${esc(t.legal)}</a> ·
    <a href="https://bepro.futbol/terminos.html" style="color:#7A7F96;">${esc(t.legal2)}</a>
  </td></tr>
</table></body></html>`;
}

/* Builds subject, HTML and plain text for one player.
   opts.parentLink — the permission link, when one was created for this send. */
export function buildInvite(a, opts = {}) {
  // The coach's own payment details, as typed on the admin page.
  const PAYMENT = opts.settings || EMPTY;
  const lang = a.formLang === 'en' ? 'en' : 'es';
  const t = T[lang];
  const now = opts.now || new Date();
  const asks = asksFor(a, now);
  const dates = eventDates(a.event, lang);
  const firstName = String(a.name || '').trim().split(/\s+/)[0] || '';
  const log = (PAYMENT.logistics || {})[a.event] || {};
  // The shared Stripe link, carrying this player's id so the payment finds
  // its way back to their card on the admin page.
  const payHref = checkoutLink(log.payLink, a.id);

  /* ---------- plain text: what people on old phones and spam filters see ---------- */
  const lines = [];
  lines.push(t.hi(firstName), '');
  lines.push(t.lead(dates).replace(/<[^>]+>/g, ''), '');
  lines.push(t.pay_h.toUpperCase());
  const amount = log.price || '';
  if (amount) lines.push(`${t.pay_amount}: ${amount}`);
  if (payHref) lines.push(`${t.pay_btn}: ${payHref}`);
  lines.push(t.pay_after, t.pay_close, '');
  if (asks.parent && opts.parentLink) {
    lines.push(t.parent_h.toUpperCase(), t.parent_p, opts.parentLink, '');
  }
  lines.push(t.doubts(WHATSAPP).replace(/<[^>]+>/g, ''), '', t.bye, t.team);
  const text = lines.join('\n');

  /* ---------- html ---------- */
  const html = shell(lang, t.subject(dates), `
  <tr><td style="padding:22px 24px 4px;">
    ${p(esc(t.hi(firstName)))}
    ${p(t.lead(esc(dates)))}
  </td></tr>
  ${box(t.pay_h,
    (amount ? p(`<strong>${esc(t.pay_amount)}: ${esc(amount)}</strong>`) : '') +
    (payHref
      ? button(payHref, t.pay_btn, '#FF6B1A') +
        p(`<span class="bp-muted" style="color:#5B6076;font-size:13px;">${esc(t.pay_btn_note)}</span>`)
      : '') +
    p(esc(t.pay_after)) +
    p(`<strong>${esc(t.pay_close)}</strong>`),
    '#FF6B1A')}
  ${asks.parent && opts.parentLink ? box(t.parent_h,
    p(esc(t.parent_p)) + button(opts.parentLink, t.parent_btn, '#FF6B1A'), '#FF6B1A') : ''}
`);

  return { lang, subject: t.subject(dates), html, text, asks };
}
