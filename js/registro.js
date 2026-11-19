/* Player registration form (registro.html).

   The server checks everything again — this file only makes mistakes easy to
   see and fix before sending. Every refusal code the server can send has an
   entry in REFUSALS; a test fails if one is missing. */

import { EVENTS, POSITIONS, LEVELS, AVAILABLE, INTEREST, MINOR_AGE, CHILD_AGE, isOpen } from './registro-config.js';

/* server code → [data-field to highlight, i18n key]. Codes that are not about
   one field highlight nothing. */
export const REFUSALS = {
  event: ['event', 'rg_err_event'],
  event_closed: ['event', 'rg_err_event_closed'],
  event_age: ['event', 'rg_err_event_age'],
  name: ['name', 'rg_err_name'],
  instagram: ['instagram', 'rg_err_instagram'],
  birthplace: ['birthplace', 'rg_err_birthplace'],
  residence: ['residence', 'rg_err_residence'],
  club: ['club', 'rg_err_club'],
  level: ['level', 'rg_err_level'],
  level_other: ['level_other', 'rg_err_level_other'],
  years_exp: ['years_exp', 'rg_err_years_exp'],
  contract: ['contract', 'rg_err_contract'],
  pro_academy: ['pro_academy', 'rg_err_pro_academy'],
  pro_academy_name: ['pro_academy_name', 'rg_err_pro_academy_name'],
  relocate: ['relocate', 'rg_err_relocate'],
  passport: ['passport', 'rg_err_passport'],
  passport_country: ['passport_country', 'rg_err_passport_country'],
  travel: ['travel', 'rg_err_travel'],
  available: ['available', 'rg_err_available'],
  interest: ['interest', 'rg_err_interest'],
  gpa: ['gpa', 'rg_err_gpa'],
  scholarship: ['scholarship', 'rg_err_scholarship'],
  parent_name: ['parent_name', 'rg_err_parent_name'],
  parent_phone: ['parent_phone', 'rg_err_parent_phone'],
  dob: ['dob', 'rg_err_dob'],
  dob_bad: ['dob', 'rg_err_dob_bad'],
  nationalities: ['nationalities', 'rg_err_nationalities'],
  phone: ['phone', 'rg_err_phone'],
  email: ['email', 'rg_err_email'],
  photo_missing: ['photo', 'rg_err_photo_missing'],
  photo_bad: ['photo', 'rg_err_photo_bad'],
  photo_big: ['photo', 'rg_err_photo_big'],
  photo_type: ['photo', 'rg_err_photo_type'],
  height: ['height', 'rg_err_height'],
  weight: ['weight', 'rg_err_weight'],
  strong_leg: ['strong_leg', 'rg_err_strong_leg'],
  position_primary: ['position_primary', 'rg_err_position_primary'],
  position_secondary: ['position_secondary', 'rg_err_position_secondary'],
  video_url: ['video_url', 'rg_err_video_url'],
  emergency_name: ['emergency_name', 'rg_err_emergency_name'],
  emergency_phone: ['emergency_phone', 'rg_err_emergency_phone'],
  emergency_relationship: ['emergency_relationship', 'rg_err_emergency_relationship'],
  waiver: ['waiver', 'rg_err_waiver'],
  signature: ['signature', 'rg_err_signature'],
  parent_email: ['parent_email', 'rg_err_parent_email'],
  parent_confirm: ['parent_confirm', 'rg_err_parent_confirm'],
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

  const openEvents = EVENTS.filter((e) => isOpen(e));
  if (!openEvents.length) {
    form.hidden = true;
    $('rgClosed').hidden = false;
    return;
  }

  /* ---------- the events, above the form: pick one or several ----------
     Once the birth date is in, the dates that are not for that age are
     greyed out, so nobody picks one the server would refuse. */
  const picked = new Set(openEvents.length === 1 ? [openEvents[0].id] : []);
  const fits = (e, dob) => {
    const y = Number(String(dob).slice(0, 4));
    return y >= e.years[0] && y <= e.years[1];
  };
  const dobNow = () => (/^\d{4}-\d{2}-\d{2}$/.test($('rgDob').value) ? $('rgDob').value : '');
  const fill = (key, a, b) => t(key).replace('{a}', a).replace('{b}', b);
  const evName = (e) => (e.name ? e.name[lang()] : e.leagues.join(' · '));

  function renderEventCards() {
    const dob = dobNow();
    $('rgEventCards').replaceChildren(...openEvents.map((e) => {
      const ok = !dob || fits(e, dob);
      const on = picked.has(e.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'rg-event-card' + (on ? ' active' : '') + (ok ? '' : ' rg-event-off');
      card.dataset.event = e.id;
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (!ok) card.setAttribute('aria-disabled', 'true');

      const dates = document.createElement('div');
      dates.className = 'rg-event-dates';
      dates.textContent = e.dates[lang()];

      const name = document.createElement('div');
      name.className = 'rg-event-name';
      name.textContent = evName(e);

      const years = document.createElement('div');
      years.className = 'rg-event-years';
      const line = (text) => { const x = document.createElement('span'); x.textContent = text; return x; };
      if (e.ages) years.append(line(fill('rg_ev_ages', e.ages[0], e.ages[1])));
      years.append(line(t('rg_ev_born') + ' ' + e.years[0] + '–' + e.years[1]));

      const pick = document.createElement('span');
      pick.className = 'rg-event-pick';
      pick.textContent = !ok ? t('rg_ev_noage') : on ? t('rg_ev_picked') : t('rg_ev_pick');

      card.append(dates, name, years, pick);
      return card;
    }));
  }

  $('rgEventCards').addEventListener('click', (e) => {
    const card = e.target.closest('.rg-event-card');
    if (!card || card.classList.contains('rg-event-off')) return;
    const id = card.dataset.event;
    picked.has(id) ? picked.delete(id) : picked.add(id);
    renderEventCards();
    if (lastError && lastError[0] === 'event') clearError();
  });

  /* ---------- dropdowns, in the current language ---------- */
  function fillSelect(sel, list) {
    const keep = sel.value;
    sel.replaceChildren(new Option(t('rg_choose'), ''), ...list.map((x) => new Option(x[lang()], x.id)));
    sel.value = keep;
  }
  function renderOptions() {
    renderEventCards();
    document.querySelectorAll('.rg-position').forEach((sel) => fillSelect(sel, POSITIONS));
    fillSelect($('rgLevel'), LEVELS);
    fillSelect($('rgAvailable'), AVAILABLE);
    fillSelect($('rgInterest'), INTEREST);
  }

  /* ---------- follow-up questions that only appear on the right answer ---------- */
  const radio = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
  function updateFollowUps() {
    $('rgLevelOtherGroup').hidden = $('rgLevel').value !== 'otro';
    $('rgProAcademyGroup').hidden = radio('proAcademy') !== 'yes';
    $('rgPassportGroup').hidden = radio('passport') !== 'yes';
  }
  form.addEventListener('change', (e) => {
    if (['level', 'proAcademy', 'passport'].includes(e.target.name)) updateFollowUps();
  });

  /* Under 18 the emergency contact is usually the same parent: one tap copies it. */
  function copyParentToEmergency() {
    if (!$('rgEmSame').checked) return;
    $('rgEmName').value = $('rgParentName').value;
    $('rgEmPhone').value = $('rgParentPhone').value;
  }
  $('rgEmSame').addEventListener('change', () => {
    const same = $('rgEmSame').checked;
    copyParentToEmergency();
    $('rgEmName').readOnly = same;
    $('rgEmPhone').readOnly = same;
    if (!same) { $('rgEmName').value = ''; $('rgEmPhone').value = ''; }
  });
  $('rgParentName').addEventListener('input', copyParentToEmergency);
  $('rgParentPhone').addEventListener('input', copyParentToEmergency);

  /* ---------- signature: under 18, a parent or guardian signs ---------- */
  function playerAge() {
    const v = $('rgDob').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(v + 'T00:00:00');
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() ||
        (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  }
  function isMinor() {
    const age = playerAge();
    return age !== null && age < MINOR_AGE;
  }
  function isChild() {
    const age = playerAge();
    return age !== null && age < CHILD_AGE;
  }
  // Switching the data-i18n key (not just the text) keeps the right wording
  // when i18n.js re-translates the page on a language change.
  function setKey(el, key) {
    el.dataset.i18n = key;
    el.textContent = t(key);
  }
  function updateGuardian() {
    const minor = isMinor();
    // Under 18: the parent's name and phone, so the invitation reaches them too.
    $('rgParentBlock').hidden = !minor;
    $('rgEmSameWrap').hidden = !minor;
    if (!minor && $('rgEmSame').checked) {
      $('rgEmSame').checked = false;
      $('rgEmName').readOnly = false;
      $('rgEmPhone').readOnly = false;
    }
    setKey($('rgSignLabel'), minor ? 'rg_sign_minor' : 'rg_sign');
    setKey($('rgSignHelp'), minor ? 'rg_sign_help_minor' : 'rg_sign_help');

    // Under 13 the parent's own email and a plain statement that it is them.
    const child = isChild();
    $('rgChildBlock').hidden = !child;
    $('rgParentEmail').required = child;
    if (!child) { $('rgParentEmail').value = ''; $('rgParentConfirm').checked = false; }
  }
  /* The way out for a player whose phone will not give them a shareable link:
     send the video to Be Pro on WhatsApp. The message is written for them, in
     the language they are filling the form in. */
  function updateVideoWa() {
    const href = 'https://wa.me/17028319474?text=' + encodeURIComponent(t('rg_video_wa_msg'));
    $('rgVideoWa').href = href;
    $('rgDoneWa').href = href;
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
    box.textContent = key === 'rg_err_event_age' ? eventAgeMessage()
      : key === 'rg_err_duplicate' ? duplicateMessage() : t(key);
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

  /* Wrong birth year for a picked date: say which years it takes. */
  let badEvent = null;
  function eventAgeMessage() {
    const e = openEvents.find((x) => x.id === badEvent) || openEvents.find((x) => picked.has(x.id) && !fits(x, dobNow()));
    let msg = e ? t('rg_err_event_age').replace('{from}', e.years[0]).replace('{to}', e.years[1]) : '';
    const dob = dobNow();
    if (dob && !openEvents.some((x) => fits(x, dob))) msg += ' ' + t('rg_err_event_none');
    return (e ? e.label[lang()] + ': ' : '') + msg.trim();
  }
  let dupEvents = [];
  function duplicateMessage() {
    const names = dupEvents.map((id) => (EVENTS.find((x) => x.id === id) || { label: { es: id, en: id } }).label[lang()]);
    return t('rg_err_duplicate').replace('{events}', names.join(' · ') || '—');
  }

  /* ---------- collect + quick checks (the server has the final word) ---------- */
  function collect() {
    const v = (name) => (form.elements[name].value || '').trim();
    const yn = (name) => { const r = radio(name); return r === 'yes' ? true : r === 'no' ? false : null; };
    return {
      events: openEvents.filter((e) => picked.has(e.id)).map((e) => e.id),
      name: v('name'),
      dob: v('dob'),
      birthplace: v('birthplace'),
      nationalities: v('nationalities'),
      residence: v('residence'),
      height: v('height'),
      weight: v('weight'),
      strongLeg: radio('strongLeg') || '',
      positionPrimary: v('positionPrimary'),
      positionSecondary: v('positionSecondary'),
      club: v('club'),
      lastClub: v('lastClub'),
      level: v('level'),
      levelOther: v('levelOther'),
      yearsExp: v('yearsExp'),
      contract: yn('contract'),
      proAcademy: yn('proAcademy'),
      proAcademyName: v('proAcademyName'),
      relocate: yn('relocate'),
      passport: yn('passport'),
      passportCountry: v('passportCountry'),
      travel: yn('travel'),
      available: v('available'),
      interest: v('interest'),
      school: v('school'),
      grade: v('grade'),
      gpa: v('gpa'),
      scholarship: yn('scholarship'),
      phone: v('phone'),
      email: v('email'),
      parentName: v('parentName'),
      parentPhone: v('parentPhone'),
      instagram: v('instagram'),
      videoUrl: v('videoUrl'),
      emergencyName: v('emergencyName'),
      emergencyPhone: v('emergencyPhone'),
      emergencyRelationship: v('emergencyRelationship'),
      waiverAccepted: $('rgWaiver').checked,
      consentShare: $('rgConsent').checked,
      signatureName: v('signatureName'),
      parentEmail: v('parentEmail'),
      parentConfirm: $('rgParentConfirm').checked,
      lang: lang(),
      photo: photoUrl,
      website: v('website'),
    };
  }

  /* The same order as the server, so the first thing it would refuse is the
     first thing highlighted here. */
  function firstProblem(b) {
    const digits = (s) => s.replace(/\D/g, '').length;
    const num = (s) => Number(String(s).replace(',', '.').replace(/[^\d.]/g, ''));
    if (!b.events.length) return 'event';
    if (!b.name) return 'name';
    if (!b.dob) return 'dob';
    badEvent = null;
    const wrong = openEvents.find((e) => b.events.includes(e.id) && !fits(e, b.dob));
    if (wrong) { badEvent = wrong.id; return 'event_age'; }
    if (!b.birthplace) return 'birthplace';
    if (!b.nationalities) return 'nationalities';
    if (!b.residence) return 'residence';
    if (!num(b.height)) return 'height';
    if (!num(b.weight)) return 'weight';
    if (!b.strongLeg) return 'strong_leg';
    if (!b.photo) return 'photo_missing';
    if (!b.positionPrimary) return 'position_primary';
    if (!b.positionSecondary) return 'position_secondary';
    if (!b.club) return 'club';
    if (!b.level) return 'level';
    if (b.level === 'otro' && !b.levelOther) return 'level_other';
    if (!/^\d{1,2}$/.test(b.yearsExp)) return 'years_exp';
    if (b.contract === null) return 'contract';
    if (b.proAcademy === null) return 'pro_academy';
    if (b.proAcademy && !b.proAcademyName) return 'pro_academy_name';
    if (b.relocate === null) return 'relocate';
    if (b.passport === null) return 'passport';
    if (b.passport && !b.passportCountry) return 'passport_country';
    if (b.travel === null) return 'travel';
    if (!b.available) return 'available';
    if (!b.interest) return 'interest';
    if (b.gpa && !/^\d([.,]\d{1,2})?$/.test(b.gpa)) return 'gpa';
    if (b.scholarship === null) return 'scholarship';
    if (digits(b.phone) < 7 || digits(b.phone) > 15) return 'phone';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(b.email)) return 'email';
    if (isMinor()) {
      if (!b.parentName) return 'parent_name';
      if (digits(b.parentPhone) < 7 || digits(b.parentPhone) > 15) return 'parent_phone';
    }
    if (!b.emergencyName) return 'emergency_name';
    if (digits(b.emergencyPhone) < 7 || digits(b.emergencyPhone) > 15) return 'emergency_phone';
    if (!b.emergencyRelationship) return 'emergency_relationship';
    if (!b.waiverAccepted) return 'waiver';
    if (!b.signatureName) return 'signature';
    if (isChild()) {
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(b.parentEmail)) return 'parent_email';
      if (!b.parentConfirm) return 'parent_confirm';
    }
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
      // Nothing to chase when they gave a link; when they did not, this is the
      // moment they are most likely to send the video.
      const noVideo = !$('rgVideo').value.trim();
      $('rgDoneVideo').hidden = !noVideo;
      $('rgDoneWa').hidden = !noVideo;
      $('rgDone').hidden = false;
      $('rgDone').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const code = data.code || data.error;
    if (code === 'event_age') badEvent = data.event || null;
    if (code === 'duplicate') dupEvents = data.events || [];
    const hit = REFUSALS[code];
    showError(...(hit || [null, 'rg_err_server_error']));
  });

  const onDob = () => { updateGuardian(); renderEventCards(); };
  $('rgDob').addEventListener('change', onDob);
  $('rgDob').addEventListener('input', onDob);
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
      updateVideoWa();
    });
  });

  renderOptions();
  updateFollowUps();
  updateGuardian();
  updateDate();
  updateVideoWa();
  resetPhoto();
}
