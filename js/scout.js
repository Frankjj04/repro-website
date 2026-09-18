/* The page a scout opens from a shared link (scout.html?t=TOKEN).

   Everything shown comes from /api/share, which decides what a scout may see.
   All values are written with textContent. */

import { POSITIONS } from './registro-config.js';

const $ = (id) => document.getElementById(id);
const WHATSAPP = '17028319474';

const T = {
  es: {
    loading: 'Cargando perfiles…',
    unavailable_h: 'LINK NO DISPONIBLE',
    unavailable_p: 'Este link venció o fue desactivado. Pide uno nuevo a BE PRO Futbol.',
    tag: 'Perfiles de jugadores',
    title: 'TALENTO <span style="color:var(--orange);">BE PRO</span>',
    for: 'Compartido con', until: 'Disponible hasta',
    players: (n) => n + (n === 1 ? ' jugador' : ' jugadores'),
    all: 'Todos', category: 'Categoría', years: 'años',
    born: 'Nació en', nationality: 'Nacionalidad', height: 'Estatura', weight: 'Peso',
    foot: 'Pierna hábil', positions: 'Posiciones', mls: 'Jugó MLS NEXT',
    right: 'Derecha', left: 'Izquierda', both: 'Ambas',
    video: '▶ Ver video', novideo: 'Sin video',
    ask: 'Preguntar por este jugador',
    none: 'No hay perfiles para mostrar en este link.',
    contact_h: '¿TE INTERESA UN JUGADOR?',
    contact_p: 'Todos los contactos pasan por BE PRO Futbol. Escríbenos y te conectamos con el jugador y su familia.',
    contact_btn: 'Contactar a BE PRO Futbol',
    wa_general: 'Hola BE PRO Futbol, vi los perfiles de jugadores que me compartieron y quiero más información.',
    wa_player: (name, y) => `Hola BE PRO Futbol, vi el perfil de ${name} (categoría ${y}) y me interesa. ¿Podemos hablar?`,
    confidential: '<strong>Confidencial.</strong> Estos perfiles se comparten con autorización de cada jugador o de su padre, madre o tutor, solo para evaluación y reclutamiento. No los reenvíes, publiques ni descargues.',
    locale: 'es-MX',
  },
  en: {
    loading: 'Loading profiles…',
    unavailable_h: 'LINK NOT AVAILABLE',
    unavailable_p: 'This link has expired or was turned off. Ask BE PRO Futbol for a new one.',
    tag: 'Player profiles',
    title: 'BE PRO <span style="color:var(--orange);">TALENT</span>',
    for: 'Shared with', until: 'Available until',
    players: (n) => n + (n === 1 ? ' player' : ' players'),
    all: 'All', category: 'Birth year', years: 'years old',
    born: 'Born in', nationality: 'Nationality', height: 'Height', weight: 'Weight',
    foot: 'Strong leg', positions: 'Positions', mls: 'Played MLS NEXT',
    right: 'Right', left: 'Left', both: 'Both',
    video: '▶ Watch video', novideo: 'No video',
    ask: 'Ask about this player',
    none: 'There are no profiles to show on this link.',
    contact_h: 'INTERESTED IN A PLAYER?',
    contact_p: 'All contact goes through BE PRO Futbol. Message us and we will connect you with the player and their family.',
    contact_btn: 'Contact BE PRO Futbol',
    wa_general: 'Hi BE PRO Futbol, I saw the player profiles you shared with me and would like more information.',
    wa_player: (name, y) => `Hi BE PRO Futbol, I saw ${name}'s profile (born ${y}) and I'm interested. Can we talk?`,
    confidential: '<strong>Confidential.</strong> These profiles are shared with the permission of each player or their parent or guardian, for evaluation and recruitment only. Do not forward, publish or download them.',
    locale: 'en-US',
  },
};

let lang = 'es';
try { lang = localStorage.getItem('bepro_lang') === 'en' ? 'en' : 'es'; } catch {}
let data = null;
let year = '';

const t = (k) => T[lang][k];
const wa = (text) => 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
  document.querySelectorAll('[data-t-html]').forEach((n) => { n.innerHTML = t(n.dataset.tHtml); });
  document.querySelector('.sc-footer p').innerHTML = t('confidential');
  document.querySelectorAll('[data-sc-lang]').forEach((b) => b.classList.toggle('active', b.dataset.scLang === lang));
  $('scContact').href = wa(t('wa_general'));
  $('scUnavailableContact').href = wa(t('wa_general'));
}

function position(id) {
  const p = POSITIONS.find((x) => x.id === id);
  return p ? p[lang] : id;
}

function card(p) {
  const c = el('article', 'sc-card');

  const photo = el('div', 'sc-photo');
  if (p.photo) {
    const img = el('img');
    img.src = p.photo; img.alt = p.name; img.loading = 'lazy';
    photo.append(img);
  } else {
    photo.classList.add('sc-nophoto');
    photo.textContent = p.name.trim().charAt(0).toUpperCase();
  }
  const badge = el('span', 'sc-pos', p.positionPrimary);
  photo.append(badge);

  const body = el('div', 'sc-card-body');
  body.append(
    el('h3', 'sc-name', p.name),
    el('div', 'sc-sub', t('category') + ' ' + p.birthYear + ' · ' + p.age + ' ' + t('years')),
  );

  const facts = el('dl', 'sc-facts');
  [
    [t('positions'), position(p.positionPrimary) + ' / ' + position(p.positionSecondary)],
    [t('foot'), t(p.strongLeg) || p.strongLeg],
    [t('height'), p.height],
    [t('weight'), p.weight],
    [t('nationality'), p.nationalities],
    [t('born'), p.birthplace],
  ].forEach(([k, v]) => facts.append(el('dt', null, k), el('dd', null, v)));
  body.append(facts);

  if (p.mlsNext) body.append(el('span', 'sc-mls', '★ ' + t('mls')));

  const actions = el('div', 'sc-actions');
  if (/^https?:\/\//i.test(p.videoUrl || '')) {
    const v = el('a', 'btn btn-primary btn-sm', t('video'));
    v.href = p.videoUrl; v.target = '_blank'; v.rel = 'noopener noreferrer';
    actions.append(v);
  } else {
    actions.append(el('span', 'sc-novideo', t('novideo')));
  }
  const ask = el('a', 'sc-ask', t('ask'));
  ask.href = wa(t('wa_player')(p.name, p.birthYear)); ask.target = '_blank'; ask.rel = 'noopener noreferrer';
  actions.append(ask);
  body.append(actions);

  c.append(photo, body);
  return c;
}

function render() {
  applyStatic();
  if (!data) return;

  $('scRecipient').textContent = data.recipient;
  $('scUntil').textContent = new Date(data.expiresAt).toLocaleDateString(t('locale'), { day: 'numeric', month: 'long', year: 'numeric' });
  $('scCount').textContent = t('players')(data.players.length);

  const years = [...new Set(data.players.map((p) => p.birthYear))].sort();
  if (year && !years.includes(year)) year = '';
  const chip = (value, label, n) => {
    const b = el('button', 'sc-year' + (year === value ? ' active' : ''));
    b.type = 'button'; b.dataset.year = value;
    b.append(document.createTextNode(label + ' '), el('span', null, String(n)));
    return b;
  };
  $('scYears').replaceChildren(...(years.length > 1
    ? [chip('', t('all'), data.players.length), ...years.map((y) => chip(y, y, data.players.filter((p) => p.birthYear === y).length))]
    : []));

  const shown = data.players.filter((p) => !year || p.birthYear === year);
  if (!shown.length) {
    $('scList').replaceChildren(el('p', 'sc-none', t('none')));
    return;
  }
  const out = [];
  (year ? [year] : years).forEach((y) => {
    const group = shown.filter((p) => p.birthYear === y);
    if (!group.length) return;
    const head = el('h2', 'sc-group');
    head.append(document.createTextNode(t('category') + ' ' + y + ' '), el('span', null, t('players')(group.length)));
    const grid = el('div', 'sc-grid');
    grid.append(...group.map(card));
    out.push(head, grid);
  });
  $('scList').replaceChildren(...out);
}

document.addEventListener('click', (e) => {
  const l = e.target.closest('[data-sc-lang]');
  if (l) { lang = l.dataset.scLang; try { localStorage.setItem('bepro_lang', lang); } catch {} render(); }
  const y = e.target.closest('.sc-year');
  if (y) { year = y.dataset.year; render(); }
});

(async () => {
  applyStatic();
  const token = new URLSearchParams(location.search).get('t') || '';
  let res = null;
  try { res = await fetch('/api/share?t=' + encodeURIComponent(token), { referrerPolicy: 'no-referrer' }); } catch {}
  $('scLoading').hidden = true;
  if (!res || !res.ok) { $('scUnavailable').hidden = false; return; }
  data = await res.json();
  $('scContent').hidden = false;
  render();
})();
