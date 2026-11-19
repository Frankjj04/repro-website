/* The event cards on the home and events pages, and the 2027 calendar, all
   built from js/registro-config.js — the same list the sign-up form and the
   server use — so adding an event there is the only step (2026-11-19).
   Redrawn when the language changes. */
import { EVENTS, isOpen, isPast } from './registro-config.js';

const lang = () => (typeof I18N !== 'undefined' && I18N.current) || 'es';
const t = (key) => ((typeof BEPRO_TRANSLATIONS !== 'undefined' && BEPRO_TRANSLATIONS[lang()]) || {})[key] || key;
const fill = (key, a, b) => t(key).replace('{a}', a).replace('{b}', b);
const name = (e) => (e.name ? e.name[lang()] : e.leagues.join(' · '));
const ages = (e) => (e.ages ? fill('ev_ages', e.ages[0], e.ages[1]) + ' · ' : '') + fill('ev_born', e.years[0], e.years[1]);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function cta(primary, key = 'cal_open') {
  const a = el('a', 'btn btn-sm ' + (primary ? 'btn-primary' : 'btn-outline'), t(key));
  a.href = 'registro.html';
  return a;
}
const upcoming = () => EVENTS.filter((e) => isOpen(e))
  .sort((x, y) => (x.start || '').localeCompare(y.start || ''));

function home(box) {
  box.replaceChildren(...upcoming().slice(0, 3).map((e, i) => {
    const card = el('div', 'upcoming-card' + (i === 0 ? ' featured-event' : ''));
    const type = el('div', 'uc-type', name(e));
    if (i === 0) type.style.color = 'var(--orange)';
    const btn = cta(i === 0);
    btn.style.marginTop = '1.5rem';
    card.append(type, el('div', 'uc-city', e.short[lang()]), el('div', 'uc-location', ages(e)), btn);
    return card;
  }));
}

function openCards(box) {
  box.replaceChildren(...upcoming().map((e, i) => {
    const card = el('article', 'ev26-card' + (i === 0 ? ' ev26-featured' : ''));
    const ul = el('ul', 'ev26-leagues');
    ul.append(el('li', null, name(e)));
    if (e.divisions) ul.append(el('li', 'ev26-div', e.divisions));
    card.append(el('div', 'ev26-date', e.short[lang()]), el('div', 'ev26-years', ages(e)), ul, cta(i === 0));
    return card;
  }));
}

function calendar(box) {
  const year = EVENTS.filter((e) => (e.start || '').startsWith('2027'));
  const head = el('div', 'cal-row cal-head');
  ['#', t('cal_month'), t('cal_dates'), t('cal_ages'), t('cal_event'), ''].forEach((h) => head.append(el('div', null, h)));
  box.replaceChildren(head, ...year.map((e, i) => {
    const row = el('div', 'cal-row' + (isOpen(e) ? ' cal-open' : ''));
    const month = new Date(e.start + 'T12:00:00Z').toLocaleDateString(lang() === 'en' ? 'en-US' : 'es-MX', { month: 'long', timeZone: 'UTC' });
    const ev = el('div', 'cal-ev');
    ev.append(el('strong', null, name(e)), el('span', null, e.divisions || ''));
    if (e.ages) ev.append(el('span', 'cal-ev-ages', fill('ev_ages', e.ages[0], e.ages[1])));
    const status = el('div', 'cal-status');
    status.append(isPast(e) ? el('span', 'cal-tag', t('cal_done'))
      : isOpen(e) ? cta(false) : el('span', 'cal-tag', t('cal_soon')));
    row.append(el('div', 'cal-n', String(i + 1)), el('div', 'cal-month', month),
      el('div', 'cal-dates', e.dates[lang()].replace(/ de [a-z]+$/i, '').replace(/^[A-Za-z]+ /, '')),
      el('div', 'cal-ages', e.ages ? e.ages[0] + '–' + e.ages[1] : ''), ev, status);
    return row;
  }));
}

function draw() {
  const h = document.getElementById('homeEventCards');
  const o = document.getElementById('evOpenCards');
  const c = document.getElementById('evCalendar');
  if (h) home(h);
  if (o) openCards(o);
  if (c) calendar(c);
}

draw();
// i18n.js switches the language on the same click; redraw right after it.
document.addEventListener('click', (e) => { if (e.target.closest('.lang-btn')) setTimeout(draw); });
