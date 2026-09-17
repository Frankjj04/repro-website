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
  name: ['name', 'rg_err_name'],
  dob: ['dob', 'rg_err_dob'],
  dob_bad: ['dob', 'rg_err_dob_bad'],
  birthplace: ['birthplace', 'rg_err_birthplace'],
  nationalities: ['nationalities', 'rg_err_nationalities'],
  phone: ['phone', 'rg_err_phone'],
  email: ['email', 'rg_err_email'],
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
  guardian_name: ['guardian_name', 'rg_err_guardian_name'],
  waiver: ['waiver', 'rg_err_waiver'],
  duplicate: ['email', 'rg_err_duplicate'],
  server_error: [null, 'rg_err_server_error'],
  not_configured: [null, 'rg_err_not_configured'],
};

// Only run in the browser page, so tests can import REFUSALS.
if (typeof document !== 'undefined') init();

function init() {
  const form = document.getElementById('rgForm');
  const $ = (id) => document.getElementById(id);
  const lang = () => (window.I18N && I18N.current) || 'es';
  const t = (key) => (BEPRO_TRANSLATIONS[lang()] || {})[key] || key;

  let lastError = null;          // [field, key] — re-translated on language change

  const openEvents = EVENTS.filter((e) => e.open);
  if (!openEvents.length) {
    form.hidden = true;
    $('rgClosed').hidden = false;
    return;
  }

  /* ---------- dropdowns, in the current language ---------- */
  function renderOptions() {
    const ev = $('rgEvent');
    const keepEv = ev.value;
    ev.replaceChildren(...openEvents.map((e) => new Option(e.label[lang()], e.id)));
    if (keepEv) ev.value = keepEv;
    // With one open event there is nothing to choose; the dropdown just shows it.
    ev.disabled = openEvents.length === 1;

    document.querySelectorAll('.rg-position').forEach((sel) => {
      const keep = sel.value;
      const blank = new Option(t('rg_choose'), '');
      sel.replaceChildren(blank, ...POSITIONS.map((p) => new Option(p[lang()], p.id)));
      sel.value = keep;
    });
  }

  /* ---------- under 18: a parent or guardian accepts the waiver ---------- */
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
  function updateGuardian() {
    $('rgGuardian').hidden = !isMinor();
  }

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
    box.textContent = t(key);
    box.hidden = false;
    const group = field && form.querySelector(`[data-field="${field}"]`);
    if (group) {
      group.classList.add('rg-invalid');
      group.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = group.querySelector('input:not([type=radio]), select, input[type=radio]');
      if (input) input.focus({ preventScroll: true });
    } else {
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
      guardianName: isMinor() ? v('guardianName') : '',
      waiverAccepted: $('rgWaiver').checked,
      website: v('website'),
    };
  }

  function firstProblem(b) {
    const digits = (s) => s.replace(/\D/g, '').length;
    if (!b.name) return 'name';
    if (!b.dob) return 'dob';
    if (!b.birthplace) return 'birthplace';
    if (!b.nationalities) return 'nationalities';
    if (digits(b.phone) < 7 || digits(b.phone) > 15) return 'phone';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(b.email)) return 'email';
    if (!b.height) return 'height';
    if (!b.weight) return 'weight';
    if (b.mlsNext === null) return 'mls_next';
    if (!b.strongLeg) return 'strong_leg';
    if (!b.positionPrimary) return 'position_primary';
    if (!b.positionSecondary) return 'position_secondary';
    if (!b.emergencyName) return 'emergency_name';
    if (digits(b.emergencyPhone) < 7 || digits(b.emergencyPhone) > 15) return 'emergency_phone';
    if (!b.emergencyRelationship) return 'emergency_relationship';
    if (isMinor() && !b.guardianName) return 'guardian_name';
    if (!b.waiverAccepted) return 'waiver';
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
  form.addEventListener('input', (e) => {
    const g = e.target.closest('.rg-invalid');
    if (g) g.classList.remove('rg-invalid');
  });

  // i18n.js switches the static text on the same click; this runs after it.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.lang-btn')) return;
    renderOptions();
    if (lastError) $('rgError').textContent = t(lastError[1]);
    if (!sending) $('rgSubmit').textContent = t('rg_submit');
  });

  renderOptions();
  updateGuardian();
}
