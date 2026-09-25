/* Coach's page (admin.html): sign in, review applicants, mark who is selected.

   All player data is written with textContent, never innerHTML — everything
   here was typed by strangers on the internet. */

import { EVENTS, POSITIONS } from './registro-config.js';

const $ = (id) => document.getElementById(id);

const STATUS_LABEL = { pending: 'Por revisar', selected: 'Invitado', not_selected: 'No seleccionado' };
const LEG_LABEL = { right: 'Derecha', left: 'Izquierda', both: 'Ambas' };
const POS = Object.fromEntries(POSITIONS.map((p) => [p.id, p.es]));
const eventLabel = (id) => (EVENTS.find((e) => e.id === id) || { label: { es: id } }).label.es;

/* Players under this age must have a parent's permission on record. Anyone who
   registered before the form asked for it shows up as missing it. */
const CHILD_AGE = 13;
const isChild = (a) => age(a.dob) < CHILD_AGE;
const needsParent = (a) => isChild(a) && !a.parentConfirmedAt;

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
  $('adPayOpen').hidden = true;
  $('adPaymentsOpen').hidden = true;
  $('adShareModal').hidden = true;
  $('adShares').hidden = true;
  $('adPayModal').hidden = true;
  $('adInviteModal').hidden = true;
  $('adPayments').hidden = true;
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
  $('adPayOpen').hidden = false;
  $('adPaymentsOpen').hidden = false;
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
    : inYear(inEvent(active)).filter((a) => tab === 'all' || (tab === 'paid' ? a.paidAt : a.status === tab));
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
    paid: evList.filter((a) => a.paidAt).length,
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
    if (needsParent(a)) {
      const warn = el('span', 'ad-chip ad-chip-warn', '⚠ Falta permiso del tutor');
      warn.title = 'Menor de ' + CHILD_AGE + ' años sin permiso del papá, mamá o tutor registrado.';
      side.append(warn);
    }
    // Paid says it all. Otherwise only an invited player can be waiting on
    // the email, so only they say where it stands.
    if (a.paidAt) {
      side.append(el('span', 'ad-chip ad-chip-paid', '💰 Pagado' + (a.paidAmount ? ' ' + a.paidAmount : '')));
    } else if (a.status === 'selected') {
      side.append(a.invitedAt
        ? el('span', 'ad-chip ad-chip-sent', '📧 Invitado · sin pagar')
        : el('span', 'ad-chip ad-chip-warn', '📧 Sin enviar'));
    }

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
  $('adPVideoWrap').replaceChildren(v || missingVideo(a, isArchived));

  $('adPStatus').hidden = isArchived;
  $('adPStatus').querySelectorAll('button').forEach((b) =>
    b.classList.toggle('active', b.dataset.status === a.status));

  renderConsent(a, isArchived);
  renderParent(a, isArchived);
  renderInvite(a, isArchived);
  renderPaid(a, isArchived);

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
    ['Instagram', a.instagram ? '@' + a.instagram : '—',
      a.instagram ? 'https://instagram.com/' + a.instagram : ''],
    ['TikTok', a.tiktok ? '@' + a.tiktok : '—',
      a.tiktok ? 'https://tiktok.com/@' + a.tiktok : ''],
    ['Video', a.videoUrl || '—', a.videoUrl],
    ['Contacto de emergencia', a.emergencyName + ' (' + a.emergencyRelationship + ')'],
    ['Tel. de emergencia', a.emergencyPhone, 'tel:' + a.emergencyPhone],
    ['Firma', a.signatureName ? a.signatureName + (a.guardianName ? ' (padre, madre o tutor)' : '') : '—'],
    ['Descargo aceptado', fmtDate(a.waiverAcceptedAt)],
    ...(a.parentEmail
      ? [['Correo del tutor (menor de 13)', a.parentEmail, 'mailto:' + a.parentEmail],
         ['Permiso del tutor', a.parentConfirmedAt ? fmtDate(a.parentConfirmedAt) : 'Pendiente']]
      : []),
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
        : 'Su información solo la ve BE PRO. No se puede incluir en links para scouts.'),
    );
  }
}

/* ---------- no video yet ----------
   The form asks for a video now, but players who signed up before that rule
   send the link afterwards, and the coach pastes it here. */
function missingVideo(a, isArchived) {
  const box = el('div', 'ad-novideo-box');
  box.append(el('p', 'ad-novideo', 'Este jugador no mandó video.'));
  if (isArchived) return box;

  const ask = el('a', 'btn btn-secondary btn-sm', '💬 Pedir video por WhatsApp');
  ask.href = 'https://wa.me/' + waNumber(a.phone) + '?text=' + encodeURIComponent(
    'Hola ' + a.name.split(' ')[0] + ', te escribimos de BE PRO Futbol. Para completar tu registro ' +
    'nos falta el link de tu video de jugadas (YouTube, Hudl, Drive u otro). ¿Nos lo mandas por aquí?');
  ask.target = '_blank';
  ask.rel = 'noopener noreferrer';

  const input = el('input');
  input.type = 'url';
  input.placeholder = 'https://youtube.com/… (pega aquí el link que te mande)';
  input.maxLength = 500;

  const save = el('button', 'btn btn-primary btn-sm', 'Guardar video');
  save.type = 'button';
  save.addEventListener('click', async () => {
    flash($('adPError'), '');
    save.disabled = true;
    try {
      const updated = await api('PATCH', '/api/applicant?id=' + a.id, { videoUrl: input.value });
      replaceActive(updated);
      openPanel(a.id);
      render();
    } catch (err) {
      flash($('adPError'), err.message);
      save.disabled = false;
    }
  });

  const form = el('div', 'ad-parent-form');
  form.append(ask, input, save);
  box.append(form);
  return box;
}

/* ---------- parent's permission (under 13) ---------- */
function renderParent(a, isArchived) {
  const box = $('adPParent');
  box.replaceChildren();
  box.className = '';
  if (!isChild(a)) return;

  box.className = 'ad-parent ' + (a.parentEmail ? 'ad-parent-ok' : 'ad-parent-missing');

  if (a.parentConfirmedAt) {
    const how = a.parentConfirmSource === 'coach'
      ? 'Registrado por BE PRO · ' + (a.parentEmail || 'por WhatsApp al ' + a.phone)
      : 'Dado al llenar el formulario · ' + (a.parentEmail || '—');
    box.append(
      el('div', 'ad-consent-title', '✓ Permiso del papá, mamá o tutor'),
      el('div', 'ad-consent-sub', how + ' · ' + fmtDate(a.parentConfirmedAt)),
    );
    return;
  }

  box.append(
    el('div', 'ad-consent-title', '⚠ Falta el permiso del papá, mamá o tutor'),
    el('div', 'ad-consent-sub', 'Este jugador tiene menos de ' + CHILD_AGE + ' años y se registró antes de que el ' +
      'formulario pidiera el permiso. Pregúntale por WhatsApp a su papá, mamá o tutor y marca la casilla cuando te diga que sí.'),
  );
  if (isArchived) return;

  const row = el('div', 'ad-parent-form');

  const ask = el('a', 'btn btn-secondary btn-sm', '💬 Pedir permiso por WhatsApp');
  ask.href = 'https://wa.me/' + waNumber(a.phone) + '?text=' + encodeURIComponent(
    'Hola, le escribimos de BE PRO Futbol por el registro de ' + a.name + '. ' +
    'Como es menor de 13 años necesitamos que usted, como su papá, mamá o tutor, ' +
    'nos confirme que autoriza su registro y que tengamos su información. ¿Nos lo confirma por aquí?');
  ask.target = '_blank';
  ask.rel = 'noopener noreferrer';

  const check = el('label', 'ad-parent-check');
  const tick = el('input');
  tick.type = 'checkbox';
  check.append(tick, el('span', null, 'Su papá, mamá o tutor me dio el permiso.'));

  const input = el('input');
  input.type = 'email';
  input.placeholder = 'correo del tutor (opcional)';
  input.maxLength = 120;

  const save = el('button', 'btn btn-primary btn-sm', 'Registrar permiso');
  save.type = 'button';
  save.addEventListener('click', async () => {
    flash($('adPError'), '');
    save.disabled = true;
    try {
      const updated = await api('PATCH', '/api/applicant?id=' + a.id,
        { parentConfirm: tick.checked, parentEmail: input.value });
      replaceActive(updated);
      openPanel(a.id);
      render();
    } catch (err) {
      flash($('adPError'), err.message);
      save.disabled = false;
    }
  });

  row.append(ask, check, input, save);
  box.append(row);
}

/* ---------- what the invitation says about paying ----------
   The coach types this himself: it is the one thing in the email that changes
   between events, and it must never sit in a file the public can read. */
let payment = null;

function fillPayForm(p) {
  $('adPayBringEs').value = (p.bring.es || []).join('\n');
  $('adPayBringEn').value = (p.bring.en || []).join('\n');

  $('adPayLogistics').replaceChildren(...EVENTS.map((e) => {
    const l = (p.logistics || {})[e.id] || {};
    const wrap = el('div', 'ad-pay-event');
    wrap.append(el('div', 'ad-pay-event-name', e.dates.es));
    const input = (field, type, max, placeholder) => {
      const i = el('input');
      i.type = type; i.maxLength = max; i.placeholder = placeholder;
      i.value = l[field] || ''; i.dataset.event = e.id; i.dataset.field = field;
      return i;
    };
    const venue = input('venue', 'text', 160, 'Lugar — cancha y dirección (se manda al pagar)');
    // Check-in changes by birth year, so one line per group; each player is
    // sent only their own line.
    const time = el('textarea');
    time.rows = 3; time.maxLength = 700;
    time.placeholder = 'Check-in por año, uno por línea (se manda al pagar):\n2003, 2004, 2005: 9:30 AM\n2006, 2007, 2008: 11:00 AM';
    time.value = l.time || ''; time.dataset.event = e.id; time.dataset.field = 'time';
    const price = el('input');
    price.type = 'text';
    price.maxLength = 100;
    price.placeholder = 'Costo de esta fecha — ej. $150';
    price.value = l.price || '';
    price.dataset.event = e.id;
    price.dataset.field = 'price';
    const link = el('input');
    link.type = 'url';
    link.maxLength = 300;
    link.placeholder = 'Link de pago (Stripe) — https://buy.stripe.com/…';
    link.value = l.payLink || '';
    link.dataset.event = e.id;
    link.dataset.field = 'payLink';
    wrap.append(price, link, venue, time);
    return wrap;
  }));
}

function readPayForm() {
  const lines = (id) => $(id).value.split('\n').map((x) => x.trim()).filter(Boolean);
  const logistics = {};
  for (const input of $('adPayLogistics').querySelectorAll('input, textarea')) {
    const e = input.dataset.event;
    logistics[e] = logistics[e] || { price: '', payLink: '', venue: '', time: '' };
    logistics[e][input.dataset.field] = input.value;
  }
  return {
    bring: { es: lines('adPayBringEs'), en: lines('adPayBringEn') },
    logistics,
  };
}

/* Not a blocker for the invitation — only for the email after payment. */
function showDetailsMissing(gaps) {
  const n = $('adPayDetailsMissing');
  n.textContent = gaps && gaps.length
    ? 'Sin esto, quien pague no recibe los detalles solos (se los puedes mandar después desde su tarjeta): falta '
      + gaps.join('; ') + '.'
    : '';
  n.hidden = !n.textContent;
}

function showMissing(missing) {
  const ul = $('adPayMissing');
  if (!missing.length) { ul.hidden = true; return; }
  ul.replaceChildren(...missing.map((m) => el('li', null, 'Falta ' + m + '.')));
  ul.hidden = false;
}

/* One paste instead of a dozen boxes. Lines look like "costo 10-11: $365";
   the date is matched however it is written — 10-11, 10 y 11, nov-10-11. */
function parsePaste(text) {
  const strip = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const out = { events: {}, bring: [] };

  const whichEvent = (s) => {
    const digits = (s.match(/\d+/g) || []).join('-');
    return EVENTS.find((e) => {
      const d = (e.id.match(/\d+/g) || []).join('-');
      return digits === d || digits === d.split('-').reverse().join('-');
    });
  };

  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.indexOf(':');
    if (at < 1) continue;
    const key = strip(line.slice(0, at));
    const value = line.slice(at + 1).trim();
    if (!value) continue;

    const ev = whichEvent(key);
    if (ev) {
      const slot = out.events[ev.id] || (out.events[ev.id] = {});
      if (key.startsWith('costo') || key.startsWith('precio')) slot.price = value;
      else if (key.startsWith('link') || key.startsWith('pago')) slot.payLink = value;
      else if (key.startsWith('lugar') || key.startsWith('cancha')) slot.venue = value;
      else if (key.startsWith('hora') || key.startsWith('check')) slot.time = slot.time ? slot.time + '\n' + value : value;
      continue;
    }
    if (key.startsWith('traer') || key.startsWith('que traer')) {
      out.bring = value.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return out;
}

$('adPayPasteFill').addEventListener('click', () => {
  const parsed = parsePaste($('adPayPaste').value);
  let filled = 0;
  if (parsed.bring.length) { $('adPayBringEs').value = parsed.bring.join('\n'); filled++; }

  for (const input of $('adPayLogistics').querySelectorAll('input, textarea')) {
    const v = (parsed.events[input.dataset.event] || {})[input.dataset.field];
    if (v) { input.value = v; filled++; }
  }

  $('adPayPasteState').textContent = filled
    ? 'Se llenaron ' + filled + ' casillas. Revísalas y dale Guardar.'
    : 'No reconocí nada. Revisa que cada línea sea "nombre: valor".';
  $('adPayPasteState').hidden = false;
});

$('adPayOpen').addEventListener('click', async () => {
  flash($('adPayError'), '');
  $('adPaySaved').hidden = true;
  openModal('adPayModal');
  try {
    const data = await api('GET', '/api/settings');
    payment = data.payment;
    fillPayForm(payment);
    showMissing(data.missing);
    showDetailsMissing(data.detailsMissing);
  } catch (err) {
    flash($('adPayError'), err.message);
  }
});

$('adPaySave').addEventListener('click', async () => {
  const btn = $('adPaySave');
  btn.disabled = true;
  flash($('adPayError'), '');
  try {
    const data = await api('PUT', '/api/settings', { payment: readPayForm() });
    payment = data.payment;
    fillPayForm(payment);
    showMissing(data.missing);
    showDetailsMissing(data.detailsMissing);
    $('adPaySaved').textContent = data.missing.length
      ? 'Guardado. Todavía falta algo para poder mandar invitaciones.'
      : 'Guardado. Ya puedes mandar invitaciones.';
    $('adPaySaved').hidden = false;
  } catch (err) {
    flash($('adPayError'), err.message);
  }
  btn.disabled = false;
});

/* ---------- the invitation email ----------
   Marking somebody Invitado and emailing them are two separate taps on
   purpose: a status can be undone, an email cannot. */
function renderInvite(a, isArchived) {
  const box = $('adPInvite');
  box.replaceChildren();
  box.className = '';
  if (isArchived || a.status !== 'selected') return;

  box.className = 'ad-invite ' + (a.invitedAt ? 'ad-invite-sent' : 'ad-invite-todo');

  if (a.invitedAt) {
    const times = a.inviteCount > 1 ? ' · ' + a.inviteCount + ' veces' : '';
    box.append(
      el('div', 'ad-consent-title', '✓ Invitación enviada'),
      el('div', 'ad-consent-sub', (a.inviteTo || a.email) + ' · ' + fmtDate(a.invitedAt) + times),
    );
  } else {
    box.append(
      el('div', 'ad-consent-title', '📧 Todavía no le mandas la invitación'),
      el('div', 'ad-consent-sub', 'El correo lleva la fecha, el costo y su botón de pago. ' +
        'Te lo enseñamos antes de enviarlo.'),
    );
  }

  const send = el('button', 'btn btn-primary btn-sm', a.invitedAt ? 'Reenviar invitación' : '📧 Enviar invitación');
  send.type = 'button';
  send.addEventListener('click', () => openInviteModal(a));
  const row = el('div', 'ad-parent-form');
  row.append(send);
  box.append(row);
}

let inviteId = 0;
let inviteKind = '';   // '' = the invitation, 'details' = venue and time after paying

async function openInviteModal(a, kind = '') {
  inviteId = a.id;
  inviteKind = kind;
  $('adIvTitle').textContent = kind === 'details' ? 'MANDAR DETALLES DEL EVENTO' : 'ENVIAR INVITACIÓN';
  $('adIvTo').textContent = 'Para: ' + a.email;
  $('adIvSubject').textContent = '…';
  $('adIvFrame').removeAttribute('srcdoc');
  flash($('adIvError'), '');
  $('adIvBlockers').hidden = true;
  $('adIvAsks').hidden = true;
  $('adIvSend').disabled = true;
  openModal('adInviteModal');

  let data;
  try {
    data = await api('GET', '/api/invite?id=' + a.id + (kind ? '&kind=' + kind : ''));
  } catch (err) {
    return flash($('adIvError'), err.message);
  }

  $('adIvTo').textContent = 'Para: ' + [data.to, data.asks.parent && data.parentEmail ? data.parentEmail : '']
    .filter(Boolean).join(' · ');
  if (data.notice) {
    $('adIvAsks').textContent = data.notice;
    $('adIvAsks').hidden = false;
  }
  $('adIvSubject').textContent = data.subject;
  $('adIvFrame').srcdoc = data.html;

  // What else this particular email is asking the family for.
  const asks = [];
  if (data.asks.parent) asks.push('el permiso del papá, mamá o tutor (con su propio link)');
  if (asks.length) {
    $('adIvAsks').textContent = 'Este correo también pide: ' + asks.join(' y ') + '.';
    $('adIvAsks').hidden = false;
  }

  if (data.blockers.length) {
    const ul = $('adIvBlockers');
    ul.replaceChildren(...data.blockers.map((b) => el('li', null, b)));
    ul.hidden = false;
    $('adIvSend').disabled = true;
  } else {
    $('adIvSend').disabled = false;
  }
}

$('adIvSend').addEventListener('click', async () => {
  const btn = $('adIvSend');
  btn.disabled = true;
  flash($('adIvError'), '');
  try {
    const res = await api('POST', '/api/invite?id=' + inviteId + (inviteKind ? '&kind=' + inviteKind : ''), {});
    replaceActive(res.applicant);
    closeModal('adInviteModal');
    openPanel(inviteId);
    render();
  } catch (err) {
    flash($('adIvError'), err.message);
    btn.disabled = false;
  }
});

/* ---------- payments ----------
   Stripe marks the player paid by itself (api/stripe.js) and sends the
   details. The card shows where that stands, and lets the coach send the
   details by hand: a resend, or a family that paid in cash. */
function renderPaid(a, isArchived) {
  const box = $('adPPaid');
  box.replaceChildren();
  box.className = '';
  if (isArchived || (!a.paidAt && a.status !== 'selected')) return;

  box.className = 'ad-invite ' + (a.paidAt ? 'ad-invite-paid' : '');
  if (a.paidAt) {
    box.append(
      el('div', 'ad-consent-title', '💰 Pagado' + (a.paidAmount ? ' · ' + a.paidAmount : '')),
      el('div', 'ad-consent-sub', 'Stripe · ' + fmtDate(a.paidAt)),
      el('div', 'ad-consent-sub', a.detailsSentAt
        ? '✓ Detalles enviados a ' + a.detailsTo + ' · ' + fmtDate(a.detailsSentAt)
        : '⚠ Todavía no le llegan los detalles (lugar y hora). Llénalos en “Datos del pago” y mándalos aquí.'),
    );
  } else {
    box.append(
      el('div', 'ad-consent-title', 'Sin pago registrado'),
      el('div', 'ad-consent-sub', 'Cuando pague con su botón de Stripe, aparece aquí solo y le llegan los detalles. ' +
        'Si pagó de otra forma, mándale los detalles tú.'),
    );
  }
  const send = el('button', 'btn btn-secondary btn-sm', a.detailsSentAt ? 'Reenviar detalles' : '📧 Mandar detalles');
  send.type = 'button';
  send.addEventListener('click', () => openInviteModal(a, 'details'));
  const row = el('div', 'ad-parent-form');
  row.append(send);
  box.append(row);
}

$('adPaymentsOpen').addEventListener('click', async () => {
  openModal('adPayments');
  flash($('adPmError'), '');
  let list = [];
  try { list = (await api('GET', '/api/settings?payments=1')).payments; }
  catch (err) { return flash($('adPmError'), err.message); }

  $('adPmEmpty').hidden = list.length > 0;
  $('adPmList').replaceChildren(...list.map((pm) => {
    const card = el('div', 'ad-share ' + (pm.applicantId ? 'ad-share-live' : 'ad-share-off'));
    const head = el('div', 'ad-share-head');
    head.append(
      el('div', 'ad-share-name', pm.applicantName || 'Sin identificar'),
      el('span', 'ad-chip ' + (pm.applicantId ? 'ad-chip-paid' : 'ad-chip-warn'), pm.amount || '—'),
    );
    card.append(
      head,
      el('div', 'ad-share-sub', [pm.event ? eventLabel(pm.event) : '', fmtDate(pm.createdAt)].filter(Boolean).join(' · ')),
      el('div', 'ad-share-sub', 'Pagó: ' + [pm.payerName, pm.payerEmail].filter(Boolean).join(' · ')),
    );
    if (pm.applicantId && find(pm.applicantId)) {
      const open = el('button', 'btn btn-secondary btn-sm', 'Ver jugador');
      open.type = 'button';
      open.addEventListener('click', () => { closeModal('adPayments'); openPanel(pm.applicantId); });
      const actions = el('div', 'ad-share-actions');
      actions.append(open);
      card.append(actions);
    }
    return card;
  }));
});

/* ---------- share links ---------- */
let shareIds = [];

function openModal(id) {
  $(id).hidden = false;
  document.body.classList.add('ad-noscroll');
}
function closeModal(id) {
  $(id).hidden = true;
  if ($('adOverlay').hidden && $('adShareModal').hidden && $('adShares').hidden
      && $('adInviteModal').hidden && $('adPayModal').hidden && $('adPayments').hidden) {
    document.body.classList.remove('ad-noscroll');
  }
}
['adShareModal', 'adShares', 'adInviteModal', 'adPayModal', 'adPayments'].forEach((id) => {
  $(id).addEventListener('click', (e) => {
    if (e.target === $(id) || e.target.closest('[data-close]')) closeModal(id);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('adPayModal').hidden) closeModal('adPayModal');
  else if (!$('adInviteModal').hidden) closeModal('adInviteModal');
  else if (!$('adShareModal').hidden) closeModal('adShareModal');
  else if (!$('adShares').hidden) closeModal('adShares');
  else if (!$('adPayments').hidden) closeModal('adPayments');
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
      'Hola, te comparto perfiles de jugadores de BE PRO Futbol: ' + url);
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

/* ---------- the list on screen, as a sheet or as text ----------
   Both follow the filters, so "Invitados · 2008" prints and copies exactly
   those players and nothing else. */
function listTitle() {
  const parts = [];
  parts.push({ all: 'Registros', pending: 'Por revisar', selected: 'Invitados',
    not_selected: 'No seleccionados', archived: 'Archivados' }[tab]);
  if (year) parts.push('Categoría ' + year);
  const q = $('adSearch').value.trim();
  if (q) parts.push('Búsqueda: ' + q);
  return parts.join(' · ');
}

function groupByYear(rows) {
  const out = new Map();
  rows.forEach((a) => {
    const y = birthYear(a);
    if (!out.has(y)) out.set(y, []);
    out.get(y).push(a);
  });
  return out;
}

$('adPrintBtn').addEventListener('click', async () => {
  const rows = current();
  if (!rows.length) return flash($('adError'), 'No hay jugadores en esta lista.');
  flash($('adError'), '');

  const sheet = $('adPrint');
  const head = el('div', 'ad-print-head');
  head.append(
    el('div', 'ad-print-brand', 'BE PRO FUTBOL'),
    el('h1', null, listTitle()),
    el('div', 'ad-print-sub', ($('adEvent').value ? eventLabel($('adEvent').value) : 'Todos los eventos') +
      ' · ' + plural(rows.length, 'jugador', 'jugadores') + ' · ' + fmtDay(new Date().toISOString())),
  );
  sheet.replaceChildren(head);

  groupByYear(rows).forEach((group, y) => {
    const h2 = el('h2', 'ad-print-group');
    h2.append(document.createTextNode('Categoría ' + y + ' '), el('span', null, plural(group.length, 'jugador', 'jugadores')));
    sheet.append(h2);

    const table = el('table', 'ad-print-table');
    const thead = el('tr');
    ['', 'Jugador', 'Edad', 'Posiciones', 'Pierna', 'Estatura / Peso', 'Nacionalidad', 'Asistió'].forEach((t) => thead.append(el('th', null, t)));
    table.append(thead);

    group.forEach((a) => {
      const tr = el('tr');
      const photoCell = el('td', 'ad-print-photo');
      if (a.photo) {
        const img = el('img');
        img.src = a.photo; img.alt = '';
        photoCell.append(img);
      }
      tr.append(
        photoCell,
        el('td', 'ad-print-name', a.name),
        el('td', null, age(a.dob) + ''),
        el('td', null, a.positionPrimary + ' / ' + a.positionSecondary),
        el('td', null, (LEG_LABEL[a.strongLeg] || a.strongLeg).charAt(0)),
        el('td', null, a.height + ' · ' + a.weight),
        el('td', null, a.nationalities),
        el('td', 'ad-print-box', ''),
      );
      table.append(tr);
    });
    sheet.append(table);
  });

  sheet.append(el('div', 'ad-print-foot',
    'BE PRO Futbol · Las Vegas, Nevada · Documento interno con datos personales — no compartir.'));

  // A photo that has not arrived yet prints as a blank square.
  const btn = $('adPrintBtn');
  const label = btn.textContent;
  btn.textContent = 'Preparando…';
  await Promise.all([...sheet.querySelectorAll('img')].map((img) =>
    img.decode().catch(() => {})));
  btn.textContent = label;

  window.print();
});

$('adCopy').addEventListener('click', () => {
  const rows = current();
  if (!rows.length) return flash($('adError'), 'No hay jugadores en esta lista.');
  flash($('adError'), '');

  const lines = [listTitle().toUpperCase() + ' — ' +
    ($('adEvent').value ? eventLabel($('adEvent').value) : 'Todos los eventos'),
    plural(rows.length, 'jugador', 'jugadores') + ' · ' + fmtDay(new Date().toISOString()), ''];
  groupByYear(rows).forEach((group, y) => {
    lines.push('CATEGORÍA ' + y + ' (' + group.length + ')');
    group.forEach((a) => lines.push('• ' + a.name + ' — ' + age(a.dob) + ' años · ' +
      a.positionPrimary + '/' + a.positionSecondary));
    lines.push('');
  });
  copyText(lines.join('\n').trim(), $('adCopy'));
});

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
    ['Instagram', (a) => (a.instagram ? '@' + a.instagram : '')],
    ['TikTok', (a) => (a.tiktok ? '@' + a.tiktok : '')],
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
    ['Pagado', (a) => (a.paidAt ? 'Sí' : 'No')],
    ['Monto pagado', (a) => a.paidAmount || ''],
    ['Fecha de pago', (a) => a.paidAt || ''],
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
