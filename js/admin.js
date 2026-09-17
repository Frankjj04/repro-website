/* Coach's page (admin.html): sign in, review applicants, mark who is selected.

   All player data is written with textContent, never innerHTML — everything
   here was typed by strangers on the internet. */

import { EVENTS, POSITIONS } from './registro-config.js';

const $ = (id) => document.getElementById(id);

const STATUS_LABEL = { pending: 'Por revisar', selected: 'Invitado', not_selected: 'No seleccionado' };
const LEG_LABEL = { right: 'Derecha', left: 'Izquierda', both: 'Ambas' };
const POS = Object.fromEntries(POSITIONS.map((p) => [p.id, p.es]));
const eventLabel = (id) => (EVENTS.find((e) => e.id === id) || { label: { es: id } }).label.es;

let active = [];        // applicants not archived
let archived = [];
let tab = 'all';
let year = '';          // birth year filter; '' = every year
let openId = null;

/* ---------- api ---------- */
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Tu sesión terminó. Entra otra vez.'); }
  if (!res.ok) throw new Error(data.message || 'No se pudo completar. Inténtalo otra vez.');
  return data;
}

function flash(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
}

/* ---------- sign in ---------- */
function showLogin() {
  $('adMain').hidden = true;
  $('adOverlay').hidden = true;
  $('adLogout').hidden = true;
  $('adSharesOpen').hidden = true;
  $('adShareModal').hidden = true;
  $('adShares').hidden = true;
  $('adLogin').hidden = false;
  $('adPassword').focus();
}

$('adLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  flash($('adLoginError'), '');
  try {
    await api('POST', '/api/login', { password: $('adPassword').value });
    $('adPassword').value = '';
    await start();
  } catch (err) {
    flash($('adLoginError'), err.message);
  }
});

$('adLogout').addEventListener('click', async () => {
  await api('DELETE', '/api/login').catch(() => {});
  active = []; archived = [];
  $('adList').replaceChildren();
  showLogin();
});

/* ---------- load ---------- */
async function start() {
  $('adLogin').hidden = true;
  $('adMain').hidden = false;
  $('adLogout').hidden = false;
  $('adSharesOpen').hidden = false;
  flash($('adError'), '');
  try {
    [active, archived] = await Promise.all([
      api('GET', '/api/applicants'),
      api('GET', '/api/applicants?archived=1'),
    ]);
  } catch (err) {
    flash($('adError'), err.message);
  }
  renderEvents();
  render();
}

function renderEvents() {
  const sel = $('adEvent');
  const keep = sel.value;
  // Events in the config, plus any old event id still present in the data.
  const ids = [...new Set([...EVENTS.map((e) => e.id), ...active.map((a) => a.event), ...archived.map((a) => a.event)])];
  sel.replaceChildren(
    new Option('Todos los eventos', ''),
    ...ids.map((id) => new Option(eventLabel(id), id)),
  );
  sel.value = keep || (EVENTS.find((e) => e.open) || {}).id || '';
}

/* ---------- list ---------- */
function age(dob) {
  const d = new Date(dob + 'T00:00:00');
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}

function inEvent(list) {
  const ev = $('adEvent').value;
  return ev ? list.filter((a) => a.event === ev) : list;
}

function matches(a, q) {
  if (!q) return true;
  const hay = [a.name, a.email, a.phone, a.nationalities, a.birthplace,
    a.positionPrimary, a.positionSecondary, POS[a.positionPrimary], POS[a.positionSecondary]]
    .join(' ').toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

const birthYear = (a) => a.dob.slice(0, 4);
const inYear = (list) => (year ? list.filter((a) => birthYear(a) === year) : list);

/* What is on screen: event → birth year → status tab → search. Sorted oldest
   birth year first, then by name, so each age group reads as one block. */
function current() {
  const q = $('adSearch').value.trim().toLowerCase();
  const base = tab === 'archived' ? inYear(inEvent(archived))
    : inYear(inEvent(active)).filter((a) => tab === 'all' || a.status === tab);
  return base.filter((a) => matches(a, q))
    .sort((x, y) => birthYear(x).localeCompare(birthYear(y)) || x.name.localeCompare(y.name, 'es'));
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function videoLink(url, cls) {
  if (!/^https?:\/\//i.test(url || '')) return null;
  const a = el('a', cls, 'Ver video ↗');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function photoThumb(a, cls) {
  const box = el('div', cls);
  if (a.photo) {
    const img = el('img');
    img.src = a.photo;
    img.alt = '';
    img.loading = 'lazy';
    box.append(img);
  } else {
    box.classList.add('ad-nophoto');
    box.textContent = a.name.trim().charAt(0).toUpperCase();
  }
  return box;
}

function renderYears() {
  // Years come from the whole event (active + archived), so a group does not
  // vanish from the bar just because a tab or search emptied it.
  const evAll = inEvent(tab === 'archived' ? archived : active);
  const counts = {};
  evAll.forEach((a) => { counts[birthYear(a)] = (counts[birthYear(a)] || 0) + 1; });
  const years = Object.keys(counts).sort();
  if (year && !counts[year]) year = '';

  const chip = (value, label, n) => {
    const b = el('button', 'ad-year' + (year === value ? ' active' : ''));
    b.type = 'button';
    b.dataset.year = value;
    b.append(document.createTextNode(label + ' '), el('span', null, String(n)));
    return b;
  };
  $('adYears').replaceChildren(chip('', 'Todos', evAll.length), ...years.map((y) => chip(y, y, counts[y])));
}

function render() {
  renderYears();
  const evList = inYear(inEvent(active));
  const counts = {
    all: evList.length,
    pending: evList.filter((a) => a.status === 'pending').length,
    selected: evList.filter((a) => a.status === 'selected').length,
    not_selected: evList.filter((a) => a.status === 'not_selected').length,
    archived: inYear(inEvent(archived)).length,
  };
  $('adTabs').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.status === tab);
    b.setAttribute('aria-selected', b.dataset.status === tab);
    b.querySelector('span').textContent = counts[b.dataset.status];
  });

  const rows = current();
  $('adEmpty').hidden = rows.length > 0;

  const out = [];
  let lastYear = null;
  rows.forEach((a) => {
    const y = birthYear(a);
    if (y !== lastYear) {
      const n = rows.filter((r) => birthYear(r) === y).length;
      const head = el('h3', 'ad-group');
      head.append(document.createTextNode('Categoría ' + y + ' '), el('span', null, n + (n === 1 ? ' jugador' : ' jugadores')));
      out.push(head);
      lastYear = y;
    }

    const row = el('div', 'ad-row ad-row-' + a.status);
    row.dataset.id = a.id;

    const open = el('button', 'ad-row-open');
    open.type = 'button';
    const main = el('div', 'ad-row-main');
    main.append(
      el('div', 'ad-row-name', a.name),
      el('div', 'ad-row-sub',
        [age(a.dob) + ' años', a.positionPrimary + ' / ' + a.positionSecondary,
         a.nationalities, a.mlsNext ? 'MLS NEXT' : null].filter(Boolean).join(' · ')),
    );
    open.append(photoThumb(a, 'ad-thumb'), main);

    const side = el('div', 'ad-row-side');
    const video = videoLink(a.videoUrl, 'ad-chip ad-chip-video');
    if (video) video.textContent = '▶ Video';
    side.append(a.consentShare
      ? el('span', 'ad-chip ad-chip-share', '↗ Compartible')
      : el('span', 'ad-chip ad-chip-private', '🔒 Privado'));
    side.append(video || el('span', 'ad-chip ad-chip-muted', 'Sin video'));

    if (tab !== 'archived') {
      const quick = el('div', 'ad-quick');
      [['selected', '✓ Invitado'], ['not_selected', '✕ No']].forEach(([st, label]) => {
        const b = el('button', 'ad-quick-' + st + (a.status === st ? ' active' : ''), label);
        b.type = 'button';
        b.dataset.status = st;
        b.title = a.status === st ? 'Quitar (volver a Por revisar)' : STATUS_LABEL[st];
        quick.append(b);
      });
      side.append(quick);
    }

    row.append(open, side);
    out.push(row);
  });
  $('adList').replaceChildren(...out);
}

$('adList').addEventListener('click', async (e) => {
  const row = e.target.closest('.ad-row');
  if (!row) return;
  const id = Number(row.dataset.id);

  // Quick invite / not selected, straight from the list. Tapping the active
  // one again puts the player back to "Por revisar".
  const quick = e.target.closest('.ad-quick button');
  if (quick) {
    const a = active.find((x) => x.id === id);
    const status = a && a.status === quick.dataset.status ? 'pending' : quick.dataset.status;
    quick.disabled = true;
    flash($('adError'), '');
    try {
      replaceActive(await api('PATCH', '/api/applicant?id=' + id, { status }));
      render();
    } catch (err) {
      quick.disabled = false;
      flash($('adError'), err.message);
    }
    return;
  }
  if (e.target.closest('.ad-row-open')) openPanel(id);
});
$('adYears').addEventListener('click', (e) => {
  const b = e.target.closest('.ad-year');
  if (!b) return;
  year = b.dataset.year;
  render();
});
$('adTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.status;
  render();
});
$('adEvent').addEventListener('change', render);
$('adSearch').addEventListener('input', render);

/* ---------- one applicant ---------- */
function find(id) {
  return active.find((a) => a.id === id) || archived.find((a) => a.id === id);
}

/* wa.me needs the country code. A 10-digit number typed without + is taken
   as a US number, since most players without one are local. */
function waNumber(phone) {
  const d = phone.replace(/\D/g, '');
  return !phone.startsWith('+') && d.length === 10 ? '1' + d : d;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function openPanel(id) {
  const a = find(id);
  if (!a) return;
  openId = id;
  const isArchived = Boolean(a.deletedAt);

  $('adPEvent').textContent = eventLabel(a.event);
  $('adPName').textContent = a.name;
  $('adPPhoto').replaceWith(photoThumb(a, 'ad-p-photo'));
  $('adOverlay').querySelector('.ad-p-photo').id = 'adPPhoto';
  $('adPSub').textContent = ['Categoría ' + birthYear(a), age(a.dob) + ' años', POS[a.positionPrimary] || a.positionPrimary].join(' · ');

  const v = videoLink(a.videoUrl, 'btn btn-primary ad-video');
  $('adPVideoWrap').replaceChildren(v || el('p', 'ad-novideo', 'No mandó video.'));

  $('adPStatus').hidden = isArchived;
  $('adPStatus').querySelectorAll('button').forEach((b) =>
    b.classList.toggle('active', b.dataset.status === a.status));

  renderConsent(a, isArchived);

  const facts = [
    ['Fecha de nacimiento', a.dob],
    ['Lugar de nacimiento', a.birthplace],
    ['Nacionalidad(es)', a.nationalities],
    ['Teléfono', a.phone, 'tel:' + a.phone],
    ['WhatsApp', 'Abrir chat', 'https://wa.me/' + waNumber(a.phone)],
    ['Email', a.email, 'mailto:' + a.email],
    ['Estatura', a.height],
    ['Peso', a.weight],
    ['MLS NEXT', a.mlsNext ? 'Sí' : 'No'],
    ['Pierna hábil', LEG_LABEL[a.strongLeg] || a.strongLeg],
    ['Posición principal', POS[a.positionPrimary] || a.positionPrimary],
    ['Posición secundaria', POS[a.positionSecondary] || a.positionSecondary],
    ['Video', a.videoUrl || '—', a.videoUrl],
    ['Contacto de emergencia', a.emergencyName + ' (' + a.emergencyRelationship + ')'],
    ['Tel. de emergencia', a.emergencyPhone, 'tel:' + a.emergencyPhone],
    ['Firma', a.signatureName ? a.signatureName + (a.guardianName ? ' (padre, madre o tutor)' : '') : '—'],
    ['Descargo aceptado', fmtDate(a.waiverAcceptedAt)],
    ['Registrado', fmtDate(a.createdAt)],
  ];
  $('adPFacts').replaceChildren(...facts.flatMap(([k, val, href]) => {
    const dd = el('dd');
    if (href && /^(https?:|tel:|mailto:)/i.test(href)) {
      const link = el('a', null, val);
      link.href = href;
      if (href.startsWith('http')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      dd.append(link);
    } else {
      dd.textContent = val;
    }
    return [el('dt', null, k), dd];
  }));

  $('adPNote').value = a.note || '';
  $('adPNote').disabled = isArchived;
  $('adPNoteState').textContent = '';
  flash($('adPError'), '');

  $('adPArchiveBox').hidden = isArchived;
  $('adPArchiveForm').hidden = true;
  $('adPArchiveOpen').hidden = false;
  $('adPArchiveName').value = '';
  $('adPRestoreBox').hidden = !isArchived;

  $('adOverlay').hidden = false;
  document.body.classList.add('ad-noscroll');
  $('adClose').focus();
}

function closePanel() {
  $('adOverlay').hidden = true;
  document.body.classList.remove('ad-noscroll');
  openId = null;
}
$('adClose').addEventListener('click', closePanel);
$('adOverlay').addEventListener('click', (e) => { if (e.target === $('adOverlay')) closePanel(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('adOverlay').hidden) closePanel(); });

function replaceActive(updated) {
  active = active.map((a) => (a.id === updated.id ? updated : a));
}

$('adPStatus').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b || openId == null) return;
  flash($('adPError'), '');
  try {
    replaceActive(await api('PATCH', '/api/applicant?id=' + openId, { status: b.dataset.status }));
    $('adPStatus').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  } catch (err) { flash($('adPError'), err.message); }
});

let noteTimer = null;
$('adPNote').addEventListener('input', () => {
  clearTimeout(noteTimer);
  $('adPNoteState').textContent = 'Guardando…';
  const id = openId;
  noteTimer = setTimeout(async () => {
    try {
      replaceActive(await api('PATCH', '/api/applicant?id=' + id, { note: $('adPNote').value }));
      if (openId === id) $('adPNoteState').textContent = 'Guardado';
    } catch (err) {
      if (openId === id) $('adPNoteState').textContent = err.message;
    }
  }, 700);
});

$('adPArchiveOpen').addEventListener('click', () => {
  $('adPArchiveOpen').hidden = true;
  $('adPArchiveForm').hidden = false;
  $('adPArchiveName').focus();
});

$('adPArchive').addEventListener('click', async () => {
  flash($('adPError'), '');
  const id = openId;
  try {
    await api('DELETE', '/api/applicant?id=' + id, { confirmName: $('adPArchiveName').value });
    const a = active.find((x) => x.id === id);
    active = active.filter((x) => x.id !== id);
    if (a) archived.unshift({ ...a, deletedAt: new Date().toISOString() });
    closePanel();
    render();
  } catch (err) { flash($('adPError'), err.message); }
});

$('adPRestore').addEventListener('click', async () => {
  flash($('adPError'), '');
  const id = openId;
  try {
    const restored = await api('PATCH', '/api/applicant?id=' + id, { restore: true });
    archived = archived.filter((x) => x.id !== id);
    active.unshift(restored);
    closePanel();
    render();
  } catch (err) { flash($('adPError'), err.message); }
});

/* ---------- permission to share ---------- */
function renderConsent(a, isArchived) {
  const box = $('adPConsent');
  box.replaceChildren();
  box.className = 'ad-consent ' + (a.consentShare ? 'ad-consent-yes' : 'ad-consent-no');

  if (a.consentShare) {
    box.append(
      el('div', 'ad-consent-title', '✓ Autorizó compartir su perfil con scouts'),
      el('div', 'ad-consent-sub', 'Firmado por ' + (a.signatureName || '—') + ' · ' + fmtDate(a.consentShareAt) +
        (a.consentVersion ? ' · texto ' + a.consentVersion : '')),
    );
    if (!isArchived) {
      const row = el('div', 'ad-consent-actions');
      const shareBtn = el('button', 'btn btn-primary btn-sm', 'Compartir este jugador');
      shareBtn.type = 'button';
      shareBtn.addEventListener('click', () => openShareModal([a]));
      const withdraw = el('button', 'ad-link', 'Retirar autorización');
      withdraw.type = 'button';
      withdraw.addEventListener('click', async () => {
        if (!confirm('¿Retirar la autorización de ' + a.name + '?\n\nSu perfil dejará de verse en todos los links compartidos. Solo el jugador puede volver a darla, registrándose otra vez.')) return;
        try {
          replaceActive(await api('PATCH', '/api/applicant?id=' + a.id, { consentShare: false }));
          openPanel(a.id);
          render();
        } catch (err) { flash($('adPError'), err.message); }
      });
      row.append(shareBtn, withdraw);
      box.append(row);
    }
  } else {
    box.append(
      el('div', 'ad-consent-title', '🔒 No autorizó compartir'),
      el('div', 'ad-consent-sub', a.consentWithdrawnAt
        ? 'Autorización retirada el ' + fmtDate(a.consentWithdrawnAt) + ' — ya no aparece en ningún link.'
        : 'Su información solo la ve Be Pro. No se puede incluir en links para scouts.'),
    );
  }
}

/* ---------- share links ---------- */
let shareIds = [];

function openModal(id) {
  $(id).hidden = false;
  document.body.classList.add('ad-noscroll');
}
function closeModal(id) {
  $(id).hidden = true;
  if ($('adOverlay').hidden && $('adShareModal').hidden && $('adShares').hidden) {
    document.body.classList.remove('ad-noscroll');
  }
}
['adShareModal', 'adShares'].forEach((id) => {
  $(id).addEventListener('click', (e) => {
    if (e.target === $(id) || e.target.closest('[data-close]')) closeModal(id);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('adShareModal').hidden) closeModal('adShareModal');
  else if (!$('adShares').hidden) closeModal('adShares');
});

function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

function openShareModal(players) {
  const ok = players.filter((a) => a.consentShare && !a.deletedAt);
  const skipped = players.length - ok.length;
  shareIds = ok.map((a) => a.id);

  $('adSmForm').hidden = false;
  $('adSmDone').hidden = true;
  flash($('adSmError'), '');
  $('adSmRecipient').value = '';
  $('adSmDays').value = '30';

  $('adSmCount').textContent = ok.length
    ? 'Se compartirán ' + plural(ok.length, 'jugador', 'jugadores') + (ok.length === 1 ? ': ' + ok[0].name : '') + '.'
    : 'Ninguno de estos jugadores autorizó compartir su información.';
  $('adSmSkipped').hidden = !skipped || !ok.length;
  $('adSmSkipped').textContent = skipped === 1
    ? '1 jugador no autorizó compartir y no se incluirá.'
    : skipped + ' jugadores no autorizaron compartir y no se incluirán.';
  $('adSmCreate').disabled = !ok.length;

  openModal('adShareModal');
  if (ok.length) $('adSmRecipient').focus();
}

$('adShareList').addEventListener('click', () => {
  if (tab === 'archived') return flash($('adError'), 'Los registros archivados no se pueden compartir.');
  const rows = current();
  if (!rows.length) return flash($('adError'), 'No hay jugadores en esta lista.');
  flash($('adError'), '');
  openShareModal(rows);
});

const shareUrl = (token) => location.origin + '/scout.html?t=' + token;
const fmtDay = (iso) => new Date(iso).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' });

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const i = document.createElement('textarea');
    i.value = text; document.body.append(i); i.select(); document.execCommand('copy'); i.remove();
  }
  const old = btn.textContent;
  btn.textContent = '¡Copiado!';
  setTimeout(() => { btn.textContent = old; }, 1500);
}

$('adSmCreate').addEventListener('click', async () => {
  flash($('adSmError'), '');
  const btn = $('adSmCreate');
  btn.disabled = true;
  try {
    const sh = await api('POST', '/api/shares', {
      ids: shareIds, recipient: $('adSmRecipient').value, days: Number($('adSmDays').value),
    });
    const url = shareUrl(sh.token);
    $('adSmForm').hidden = true;
    $('adSmDone').hidden = false;
    $('adSmDoneText').textContent = '✓ Link listo para ' + sh.recipient + ' — ' + plural(sh.count, 'jugador', 'jugadores') +
      (sh.skipped ? ' (' + sh.skipped + ' sin autorización quedaron fuera)' : '') + '.';
    $('adSmLink').value = url;
    $('adSmWhatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(
      'Hola, te comparto perfiles de jugadores de Be Pro Soccer: ' + url);
    $('adSmPreview').href = url;
    $('adSmExpires').textContent = 'Cualquier persona con este link puede ver estos perfiles hasta el ' + fmtDay(sh.expiresAt) +
      '. Puedes desactivarlo cuando quieras en “Links compartidos”.';
    $('adSmLink').select();
  } catch (err) {
    flash($('adSmError'), err.message);
  } finally {
    btn.disabled = false;
  }
});
$('adSmCopy').addEventListener('click', () => copyText($('adSmLink').value, $('adSmCopy')));

$('adSharesOpen').addEventListener('click', async () => {
  openModal('adShares');
  await loadShares();
});

async function loadShares() {
  flash($('adShError'), '');
  let list = [];
  try { list = await api('GET', '/api/shares'); }
  catch (err) { return flash($('adShError'), err.message); }

  $('adShEmpty').hidden = list.length > 0;
  const now = Date.now();
  $('adShList').replaceChildren(...list.map((sh) => {
    const state = sh.revokedAt ? ['off', 'Desactivado']
      : new Date(sh.expiresAt).getTime() <= now ? ['expired', 'Vencido']
      : ['live', 'Activo hasta ' + fmtDay(sh.expiresAt)];

    const card = el('div', 'ad-share ad-share-' + state[0]);
    const head = el('div', 'ad-share-head');
    head.append(el('div', 'ad-share-name', sh.recipient), el('span', 'ad-chip ad-share-state', state[1]));
    card.append(
      head,
      el('div', 'ad-share-sub', plural(sh.count, 'jugador', 'jugadores') + ' · creado el ' + fmtDay(sh.createdAt)),
      el('div', 'ad-share-sub', sh.views
        ? 'Abierto ' + plural(sh.views, 'vez', 'veces') + ' · última vez ' + fmtDate(sh.lastViewedAt)
        : 'Todavía no lo han abierto'),
    );

    if (state[0] === 'live') {
      const actions = el('div', 'ad-share-actions');
      const copy = el('button', 'btn btn-secondary btn-sm', 'Copiar link');
      copy.type = 'button';
      copy.addEventListener('click', () => copyText(shareUrl(sh.token), copy));
      const open = el('a', 'btn btn-secondary btn-sm', 'Ver');
      open.href = shareUrl(sh.token); open.target = '_blank'; open.rel = 'noopener noreferrer';
      const off = el('button', 'btn btn-sm ad-btn-danger', 'Desactivar');
      off.type = 'button';
      off.addEventListener('click', async () => {
        if (!confirm('¿Desactivar el link de ' + sh.recipient + '? Dejará de funcionar al instante.')) return;
        try { await api('DELETE', '/api/shares?id=' + sh.id); await loadShares(); }
        catch (err) { flash($('adShError'), err.message); }
      });
      actions.append(copy, open, off);
      card.append(actions);
    }
    return card;
  }));
}

/* ---------- CSV of what is on screen ---------- */
$('adCsv').addEventListener('click', () => {
  const rows = current();
  const cols = [
    ['Evento', (a) => eventLabel(a.event)],
    ['Año de nacimiento', (a) => birthYear(a)],
    ['Estado', (a) => (a.deletedAt ? 'Archivado' : STATUS_LABEL[a.status])],
    ['Nombre', (a) => a.name],
    ['Fecha de nacimiento', (a) => a.dob],
    ['Edad', (a) => age(a.dob)],
    ['Lugar de nacimiento', (a) => a.birthplace],
    ['Nacionalidades', (a) => a.nationalities],
    ['Teléfono', (a) => a.phone],
    ['Email', (a) => a.email],
    ['Estatura', (a) => a.height],
    ['Peso', (a) => a.weight],
    ['MLS NEXT', (a) => (a.mlsNext ? 'Sí' : 'No')],
    ['Pierna hábil', (a) => LEG_LABEL[a.strongLeg]],
    ['Posición principal', (a) => a.positionPrimary],
    ['Posición secundaria', (a) => a.positionSecondary],
    ['Video', (a) => a.videoUrl],
    ['Contacto de emergencia', (a) => a.emergencyName],
    ['Tel. emergencia', (a) => a.emergencyPhone],
    ['Parentesco', (a) => a.emergencyRelationship],
    ['Firma', (a) => a.signatureName],
    ['Tutor que firmó', (a) => a.guardianName],
    ['Autorizó compartir', (a) => (a.consentShare ? 'Sí' : 'No')],
    ['Fecha autorización', (a) => a.consentShareAt || ''],
    ['Autorización retirada', (a) => a.consentWithdrawnAt || ''],
    ['Descargo aceptado', (a) => a.waiverAcceptedAt],
    ['Notas', (a) => a.note],
    ['Registrado', (a) => a.createdAt],
  ];
  // Leading =,+,-,@ would run as a formula in Excel; prefix with ' to keep it text.
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = [cols.map((c) => cell(c[0])).join(','),
    ...rows.map((a) => cols.map((c) => cell(c[1](a))).join(','))].join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'bepro-registros-' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

/* ---------- boot ---------- */
(async () => {
  try {
    const s = await api('GET', '/api/login');
    if (s.signedIn) return start();
  } catch { /* fall through to the sign-in form */ }
  showLogin();
})();
