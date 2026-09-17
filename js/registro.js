/* Player registration form (registro.html).

   The server checks everything again — this file only makes mistakes easy to
   see and fix before sending. Every refusal code the server can send has an
   entry in REFUSALS; a test fails if one is missing. */

import { EVENTS, POSITIONS, MINOR_AGE } from './registro-config.js';

/* server code → [data-field to highlight, i18n key]. Codes that are not about
   one field highlight nothing. */
export const REFUSALS = {
  event: ['event', 'rg_err_event'],
  event_closed: ['event', 'rg_err_event_closed'],
  event_age: ['event', 'rg_err_event_age'],
  name: ['name', 'rg_err_name'],
  dob: ['dob', 'rg_err_dob'],
  dob_bad: ['dob', 'rg_err_dob_bad'],
  birthplace: ['birthplace', 'rg_err_birthplace'],
  nationalities: ['nationalities', 'rg_err_nationalities'],
  phone: ['phone', 'rg_err_phone'],
  email: ['email', 'rg_err_email'],
  photo_missing: ['photo', 'rg_err_photo_missing'],
  photo_bad: ['photo', 'rg_err_photo_bad'],
  photo_big: ['photo', 'rg_err_photo_big'],
  photo_type: ['photo', 'rg_err_photo_type'],
  height: ['height', 'rg_err_height'],
  weight: ['weight', 'rg_err_weight'],
  mls_next: ['mls_next', 'rg_err_mls_next'],
  strong_leg: ['strong_leg', 'rg_err_strong_leg'],
  position_primary: ['position_primary', 'rg_err_position_primary'],
  position_secondary: ['position_secondary', 'rg_err_position_secondary'],
  video_url: ['video_url', 'rg_err_video_url'],
  emergency_name: ['emergency_name', 'rg_err_emergency_name'],
  emergency_phone: ['emergency_phone', 'rg_err_emergency_phone'],
  emergency_relationship: ['emergency_relationship', 'rg_err_emergency_relationship'],
  waiver: ['waiver', 'rg_err_waiver'],
  signature: ['signature', 'rg_err_signature'],
  duplicate: ['email', 'rg_err_duplicate'],
  server_error: [null, 'rg_err_server_error'],
  not_configured: [null, 'rg_err_not_configured'],
};

// Only run in the browser page, so tests can import REFUSALS.
if (typeof document !== 'undefined') init();

function init() {
  const form = document.getElementById('rgForm');
  const $ = (id) => document.getElementById(id);
  // i18n.js declares these with const, so they are globals but not window properties.
  const lang = () => (typeof I18N !== 'undefined' && I18N.current) || 'es';
  const t = (key) => (BEPRO_TRANSLATIONS[lang()] || {})[key] || key;

  let lastError = null;          // [field, key] — re-translated on language change

  const openEvents = EVENTS.filter((e) => e.open);
  if (!openEvents.length) {
    form.hidden = true;
    $('rgClosed').hidden = false;
    return;
  }

  /* ---------- the three events, above the form ---------- */
  function renderEventCards() {
    $('rgEventCards').replaceChildren(...openEvents.map((e) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'rg-event-card' + ($('rgEvent').value === e.id ? ' active' : '');
      card.dataset.event = e.id;

      const dates = document.createElement('div');
      dates.className = 'rg-event-dates';
      dates.textContent = e.dates[lang()];

      const leagues = document.createElement('ul');
      leagues.className = 'rg-event-leagues';
      e.leagues.forEach((l) => {
        const li = document.createElement('li');
        li.textContent = l;
        leagues.append(li);
      });

      const years = document.createElement('div');
      years.className = 'rg-event-years';
      years.textContent = t('rg_ev_born') + ' ' + e.years[0] + '-' + e.years[1];

      const pick = document.createElement('span');
      pick.className = 'rg-event-pick';
      pick.textContent = t('rg_ev_pick');

      card.append(dates, leagues, years, pick);
      return card;
    }));
  }

  // Tapping a card is the same as choosing it in the dropdown.
  $('rgEventCards').addEventListener('click', (e) => {
    const card = e.target.closest('.rg-event-card');
    if (!card) return;
    $('rgEvent').value = card.dataset.event;
    renderEventCards();
    clearError();
  });
  $('rgEvent').addEventListener('change', () => { renderEventCards(); });

  const eventFor = (dob) => {
    const y = Number(String(dob).slice(0, 4));
    return openEvents.find((e) => y >= e.years[0] && y <= e.years[1]);
  };

  /* ---------- dropdowns, in the current language ---------- */
  function renderOptions() {
    const ev = $('rgEvent');
    const keepEv = ev.value;
    ev.replaceChildren(...openEvents.map((e) => new Option(e.label[lang()], e.id)));
    if (keepEv) ev.value = keepEv;
    // With one open event there is nothing to choose; the dropdown just shows it.
    ev.disabled = openEvents.length === 1;
    renderEventCards();

    document.querySelectorAll('.rg-position').forEach((sel) => {
      const keep = sel.value;
      const blank = new Option(t('rg_choose'), '');
      sel.replaceChildren(blank, ...POSITIONS.map((p) => new Option(p[lang()], p.id)));
      sel.value = keep;
    });
  }

  /* ---------- signature: under 18, a parent or guardian signs ---------- */
  function isMinor() {
    const v = $('rgDob').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + 'T00:00:00');
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() ||
        (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age >= 0 && age < MINOR_AGE;
  }
  // Switching the data-i18n key (not just the text) keeps the right wording
  // when i18n.js re-translates the page on a language change.
  function setKey(el, key) {
    el.dataset.i18n = key;
    el.textContent = t(key);
  }
  function updateGuardian() {
    const minor = isMinor();
    setKey($('rgSignLabel'), minor ? 'rg_sign_minor' : 'rg_sign');
    setKey($('rgSignHelp'), minor ? 'rg_sign_help_minor' : 'rg_sign_help');
  }
  function updateDate() {
    $('rgSignDate').textContent = new Date().toLocaleDateString(lang() === 'en' ? 'en-US' : 'es-MX',
      { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---------- headshot ----------
     Shrunk in the browser before upload: a phone photo can be 5 MB, and the
     coach only needs a clear face. 600px on the long side ≈ 60–120 KB. */
  const PHOTO_MAX_PX = 600;
  const PHOTO_QUALITY = 0.82;
  let photoUrl = null;
  let photoBusy = false;

  function photoLabels() {
    $('rgPhotoBtn').textContent = t(photoUrl ? 'rg_photo_change' : 'rg_photo_btn');
    $('rgPhotoStatus').textContent = t(photoBusy ? 'rg_photo_working' : photoUrl ? 'rg_photo_ready' : 'rg_photo_help');
  }
  function resetPhoto() {
    photoUrl = null;
    photoBusy = false;
    $('rgPhoto').value = '';
    $('rgPhotoPreview').style.backgroundImage = '';
    $('rgPhotoPreview').classList.remove('has-photo');
    $('rgPhotoClear').hidden = true;
    photoLabels();
  }
  $('rgPhotoClear').addEventListener('click', resetPhoto);

  $('rgPhoto').addEventListener('change', () => {
    const file = $('rgPhoto').files && $('rgPhoto').files[0];
    if (!file) return;
    if (file.type && !/^image\//.test(file.type)) { resetPhoto(); return showError('photo', 'rg_err_photo_type'); }
    if (file.size > 40 * 1024 * 1024) { resetPhoto(); return showError('photo', 'rg_err_photo_big'); }

    photoBusy = true;
    photoLabels();
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(src); resetPhoto(); showError('photo', 'rg_err_photo_bad'); };
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      photoUrl = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
      photoBusy = false;
      $('rgPhotoPreview').style.backgroundImage = 'url("' + photoUrl + '")';
      $('rgPhotoPreview').classList.add('has-photo');
      $('rgPhotoClear').hidden = false;
      photoLabels();
      if (lastError && lastError[0] === 'photo') clearError();
    };
    img.src = src;
  });

  /* ---------- errors ---------- */
  function clearError() {
    lastError = null;
    $('rgError').hidden = true;
    form.querySelectorAll('.rg-invalid').forEach((g) => g.classList.remove('rg-invalid'));
  }
  function showError(field, key) {
    clearError();
    lastError = [field, key];
    const box = $('rgError');
    box.textContent = key === 'rg_err_event_age' ? eventAgeMessage() : t(key);
    box.hidden = false;
    const group = field && form.querySelector(`[data-field="${field}"]`);
    if (group) {
      group.classList.add('rg-invalid');
      group.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = group.querySelector('input:not([type=radio]):not([type=file]), select, input[type=radio], .rg-photo-btn');
      if (input) input.focus({ preventScroll: true });
    } else {
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* The wrong event for their birth year: say which one is theirs. */
  function eventAgeMessage() {
    const chosen = openEvents.find((e) => e.id === $('rgEvent').value);
    const mine = eventFor($('rgDob').value);
    let msg = t('rg_err_event_age');
    if (chosen) msg = msg.replace('{years}', chosen.years[0] + '-' + chosen.years[1]);
    if (mine && mine !== chosen) msg += ' ' + t('rg_err_event_yours').replace('{event}', mine.label[lang()]);
    return msg;
  }

  /* ---------- collect + quick checks (the server has the final word) ---------- */
  function collect() {
    const v = (name) => (form.elements[name].value || '').trim();
    const radio = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
    const mls = radio('mlsNext');
    return {
      event: $('rgEvent').value,
      name: v('name'),
      dob: v('dob'),
      birthplace: v('birthplace'),
      nationalities: v('nationalities'),
      phone: v('phone'),
      email: v('email'),
      height: v('height'),
      weight: v('weight'),
      mlsNext: mls === 'yes' ? true : mls === 'no' ? false : null,
      strongLeg: radio('strongLeg') || '',
      positionPrimary: v('positionPrimary'),
      positionSecondary: v('positionSecondary'),
      videoUrl: v('videoUrl'),
      emergencyName: v('emergencyName'),
      emergencyPhone: v('emergencyPhone'),
      emergencyRelationship: v('emergencyRelationship'),
      waiverAccepted: $('rgWaiver').checked,
      consentShare: $('rgConsent').checked,
      signatureName: v('signatureName'),
      lang: lang(),
      photo: photoUrl,
      website: v('website'),
    };
  }

  function firstProblem(b) {
    const digits = (s) => s.replace(/\D/g, '').length;
    if (!b.name) return 'name';
    if (!b.dob) return 'dob';
    // Only the chosen event's own range matters — 2008 fits two of them.
    const chosen = openEvents.find((e) => e.id === b.event);
    const born = Number(String(b.dob).slice(0, 4));
    if (!chosen || born < chosen.years[0] || born > chosen.years[1]) return 'event_age';
    if (!b.birthplace) return 'birthplace';
    if (!b.nationalities) return 'nationalities';
    if (digits(b.phone) < 7 || digits(b.phone) > 15) return 'phone';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(b.email)) return 'email';
    if (!b.photo) return 'photo_missing';
    if (!b.height) return 'height';
    if (!b.weight) return 'weight';
    if (b.mlsNext === null) return 'mls_next';
    if (!b.strongLeg) return 'strong_leg';
    if (!b.positionPrimary) return 'position_primary';
    if (!b.positionSecondary) return 'position_secondary';
    if (!b.emergencyName) return 'emergency_name';
    if (digits(b.emergencyPhone) < 7 || digits(b.emergencyPhone) > 15) return 'emergency_phone';
    if (!b.emergencyRelationship) return 'emergency_relationship';
    if (!b.waiverAccepted) return 'waiver';
    if (!b.signatureName) return 'signature';
    return null;
  }

  /* ---------- send ---------- */
  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;

    const body = collect();
    const problem = firstProblem(body);
    if (problem) return showError(...REFUSALS[problem]);

    clearError();
    sending = true;
    const btn = $('rgSubmit');
    btn.disabled = true;
    btn.textContent = t('rg_sending');

    let res, data = {};
    try {
      res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => ({}));
    } catch {
      res = null;
    }

    sending = false;
    btn.disabled = false;
    btn.textContent = t('rg_submit');

    if (!res) return showError(null, 'rg_err_connection');
    if (res.ok) {
      form.hidden = true;
      $('rgDone').hidden = false;
      $('rgDone').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const code = data.code || data.error;
    const hit = REFUSALS[code];
    showError(...(hit || [null, 'rg_err_server_error']));
  });

  $('rgDob').addEventListener('change', updateGuardian);
  $('rgDob').addEventListener('input', updateGuardian);
  // Fixing the highlighted field clears its message straight away.
  const clearIfFixed = (e) => {
    if (e.target.closest('.rg-invalid')) clearError();
  };
  form.addEventListener('input', clearIfFixed);
  form.addEventListener('change', clearIfFixed);

  // i18n.js switches the language on the same click, but its listener is added
  // after this one, so wait for it before redrawing.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.lang-btn')) return;
    setTimeout(() => {
      renderOptions();
      if (lastError) showError(...lastError);
      if (!sending) $('rgSubmit').textContent = t('rg_submit');
      photoLabels();
      updateDate();
    });
  });

  renderOptions();
  updateGuardian();
  updateDate();
  resetPhoto();
}
