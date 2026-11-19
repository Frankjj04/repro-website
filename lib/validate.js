/* What counts as a valid application. Every refusal carries a code, which the
   sign-up page turns into a message in the player's language on the right
   field. Add a code here → add it to REFUSALS in js/registro.js too (a test
   checks). */

import { EVENTS, POSITIONS, STRONG_LEG, LEVELS, AVAILABLE, INTEREST, MINOR_AGE, CHILD_AGE, isOpen } from '../js/registro-config.js';

export const clean = (s, max) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').slice(0, max);

/* Players apply from any country, so phones are international: keep a leading
   + and the digits, and accept 7 to 15 digits (the E.164 maximum). */
export function phone(s) {
  const raw = String(s || '').trim();
  const d = raw.replace(/\D/g, '');
  if (d.length < 7 || d.length > 15) return null;
  return (raw.startsWith('+') ? '+' : '') + d;
}

export function ageOn(dob, now = new Date()) {
  const d = new Date(dob + 'T00:00:00Z');
  if (isNaN(d)) return null;
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

/* Only http(s) links are kept. Anything else — javascript:, data: — would be
   dangerous once it is a clickable link on the coach's page. */
export function videoUrl(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : 'https://' + v;
  let u;
  try { u = new URL(withScheme); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!u.hostname.includes('.')) return null;
  return u.href.slice(0, 500);
}

/* Social handles, which people give in every possible shape: "@nombre",
   "nombre", "instagram.com/nombre", the full https URL, sometimes with a
   trailing slash or a ?query. All of them come back as the bare handle.
   Empty is fine — both fields are optional. */
export function handle(s, host) {
  let v = String(s || '').trim();
  if (!v) return '';
  v = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (host && v.toLowerCase().startsWith(host)) v = v.slice(host.length);
  v = v.split(/[/?#]/)[0].replace(/^@+/, '').trim();
  if (!v) return '';
  // Instagram and TikTok both allow letters, digits, dots and underscores.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(v)) return null;
  return v;
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;   // after the browser downscales it

/* Decodes the data URL the browser produced, and checks it really is a JPEG or
   PNG by its magic bytes — the declared type is only a claim.
   Returns { buf, type } or { code } with code 'photo_bad' | 'photo_big' | 'photo_type'. */
export function decodePhoto(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return { code: 'photo_bad' };
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) return { code: 'photo_bad' };
  if (buf.length > MAX_PHOTO_BYTES) return { code: 'photo_big' };
  const jpeg = buf[0] === 0xFF && buf[1] === 0xD8;
  const png  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  if (!jpeg && !png) return { code: 'photo_type' };
  return { buf, type: jpeg ? 'image/jpeg' : 'image/png' };
}

const POSITION_IDS = POSITIONS.map((p) => p.id);
const ids = (list) => list.map((x) => x.id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/* Height in cm and weight in kg (coach, 2026-11-19). People still type
   "1.78" or "178 cm", so take the first number; a height under 3 is metres. */
export function cm(s) {
  const m = /\d+(?:[.,]\d+)?/.exec(String(s || ''));
  if (!m) return null;
  let n = Number(m[0].replace(',', '.'));
  if (n < 3) n *= 100;
  n = Math.round(n);
  return n >= 100 && n <= 230 ? n : null;
}
export function kg(s) {
  const m = /\d+(?:[.,]\d+)?/.exec(String(s || ''));
  if (!m) return null;
  const n = Math.round(Number(m[0].replace(',', '.')));
  return n >= 25 && n <= 160 ? n : null;
}
export function gpa(s) {
  const v = String(s || '').trim().replace(',', '.');
  if (!v) return '';
  if (!/^\d(\.\d{1,2})?$/.test(v) || Number(v) > 5) return null;
  return v;
}

/* The events picked. One form can sign a player up for several dates
   (Frank, 2026-11-19): each becomes its own record, with its own invitation
   and payment, exactly as if they had filled the form once per date. */
function pickedEvents(b) {
  const raw = Array.isArray(b.events) ? b.events : (b.event ? [b.event] : []);
  return [...new Set(raw.map((x) => clean(x, 60)).filter(Boolean))].slice(0, EVENTS.length);
}

export function validateApplication(body) {
  const b = body || {};
  const fail = (code, error, extra) => ({ code, error, ...extra });
  const yes = (v) => v === true;
  const isBool = (v) => v === true || v === false;

  const a = {
    name:          clean(b.name, 100),
    dob:           clean(b.dob, 10),
    nationalities: clean(b.nationalities, 120),
    email:         clean(b.email, 120).toLowerCase(),
    strongLeg:     clean(b.strongLeg, 10),
    positionPrimary:   clean(b.positionPrimary, 10),
    positionSecondary: clean(b.positionSecondary, 10),
    emergencyName:         clean(b.emergencyName, 100),
    emergencyRelationship: clean(b.emergencyRelationship, 60),
    signatureName: clean(b.signatureName, 100),
    parentEmail:   clean(b.parentEmail, 120).toLowerCase(),
    parentName:    clean(b.parentName, 100),
    // Kept although the coach's profile does not list it (Frank, 2026-11-19).
    birthplace:    clean(b.birthplace, 120),
    // No longer asked (not on the coach's list); kept so older records and
    // the database stay the same shape.
    tiktok: '',
  };
  const p = {
    residence:      clean(b.residence, 120),
    club:           clean(b.club, 120),
    lastClub:       clean(b.lastClub, 120),
    level:          clean(b.level, 20),
    levelOther:     clean(b.levelOther, 80),
    yearsExp:       null,
    contract:       b.contract,
    proAcademy:     b.proAcademy,
    proAcademyName: clean(b.proAcademyName, 120),
    relocate:       b.relocate,
    passport:       b.passport,
    passportCountry: clean(b.passportCountry, 80),
    travel:         b.travel,
    available:      clean(b.available, 10),
    interest:       clean(b.interest, 10),
    school:         clean(b.school, 120),
    grade:          clean(b.grade, 40),
    gpa:            '',
    scholarship:    b.scholarship,
  };

  /* ---- events ---- */
  a.events = pickedEvents(b);
  if (!a.events.length) return fail('event', 'Choose at least one event.');
  const chosen = a.events.map((id) => EVENTS.find((e) => e.id === id));
  if (chosen.some((e) => !e)) return fail('event', 'Choose an event.');
  if (chosen.some((e) => !isOpen(e))) return fail('event_closed', 'Applications for this event are closed.');
  a.event = a.events[0];

  /* ---- 1 · personal ---- */
  if (!a.name) return fail('name', 'Full name is required.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dob)) return fail('dob', 'Date of birth is required.');
  const age = ageOn(a.dob);
  if (age === null || age < 6 || age > 60) return fail('dob_bad', 'That date of birth does not look right.');

  // Each date takes only its own birth years — see js/registro-config.js.
  const born = Number(a.dob.slice(0, 4));
  const wrong = chosen.find((e) => born < e.years[0] || born > e.years[1]);
  if (wrong) {
    return fail('event_age', 'That date is only for players born ' + wrong.years[0] + '-' + wrong.years[1] + '.',
      { event: wrong.id });
  }

  if (!a.birthplace) return fail('birthplace', 'Place of birth is required.');
  if (!a.nationalities) return fail('nationalities', 'Nationality is required.');
  if (!p.residence) return fail('residence', 'City and state of residence are required.');

  const h = cm(b.height);
  if (!h) return fail('height', 'Height in cm is required.');
  a.height = h + ' cm';
  const w = kg(b.weight);
  if (!w) return fail('weight', 'Weight in kg is required.');
  a.weight = w + ' kg';

  if (!STRONG_LEG.includes(a.strongLeg)) return fail('strong_leg', 'Choose your strong leg.');

  /* ---- 2 · soccer ---- */
  if (!POSITION_IDS.includes(a.positionPrimary)) return fail('position_primary', 'Choose your primary position.');
  if (!POSITION_IDS.includes(a.positionSecondary)) return fail('position_secondary', 'Choose your secondary position.');
  if (!p.club) return fail('club', 'Current club or academy is required.');
  if (!ids(LEVELS).includes(p.level)) return fail('level', 'Choose your level.');
  if (p.level === 'otro' && !p.levelOther) return fail('level_other', 'Say which level.');
  if (p.level !== 'otro') p.levelOther = '';
  const ye = String(b.yearsExp == null ? '' : b.yearsExp).trim();
  if (!/^\d{1,2}$/.test(ye) || Number(ye) > 40) return fail('years_exp', 'Years of experience is required.');
  p.yearsExp = Number(ye);
  if (!isBool(p.contract)) return fail('contract', 'Answer the contract question.');
  if (!isBool(p.proAcademy)) return fail('pro_academy', 'Answer the academy question.');
  if (p.proAcademy && !p.proAcademyName) return fail('pro_academy_name', 'Say which academy.');
  if (!p.proAcademy) p.proAcademyName = '';
  // Kept for the admin page and the scout links, which have always shown it.
  a.mlsNext = p.level === 'mls_next';

  /* ---- 3 · availability ---- */
  if (!isBool(p.relocate)) return fail('relocate', 'Answer the relocation question.');
  if (!isBool(p.passport)) return fail('passport', 'Answer the passport question.');
  if (p.passport && !p.passportCountry) return fail('passport_country', 'Say which country.');
  if (!p.passport) p.passportCountry = '';
  if (!isBool(p.travel)) return fail('travel', 'Answer the travel question.');
  if (!ids(AVAILABLE).includes(p.available)) return fail('available', 'Say when you could join a team.');
  if (!ids(INTEREST).includes(p.interest)) return fail('interest', 'Choose professional, college or both.');

  /* ---- 4 · school (only the scholarship question is required) ---- */
  p.gpa = gpa(b.gpa);
  if (p.gpa === null) return fail('gpa', 'GPA must look like 3.5.');
  if (!isBool(p.scholarship)) return fail('scholarship', 'Answer the scholarship question.');

  /* ---- 5 · contact and material ---- */
  a.phone = phone(b.phone);
  if (!a.phone) return fail('phone', 'Phone number must have 7 to 15 digits.');
  if (!EMAIL_RE.test(a.email)) return fail('email', 'That email does not look right.');

  // Under 18: the parent's name and phone, so messages reach them too.
  a.isMinor = age < MINOR_AGE;
  if (a.isMinor) {
    if (!a.parentName) return fail('parent_name', "A parent or guardian's name is required.");
    a.parentPhone = phone(b.parentPhone);
    if (!a.parentPhone) return fail('parent_phone', "A parent or guardian's phone is required.");
  } else {
    a.parentName = '';
    a.parentPhone = '';
  }

  // Optional: some players cannot get a shareable link out of their phone, so
  // they send the video over WhatsApp instead. A link that IS given still has
  // to be a real http(s) link.
  a.videoUrl = videoUrl(b.videoUrl);
  if (a.videoUrl === null) return fail('video_url', 'That video link does not look right.');

  // Optional, and asked for because scouts look players up.
  a.instagram = handle(b.instagram, 'instagram.com/');
  if (a.instagram === null) return fail('instagram', 'That Instagram name does not look right.');

  /* ---- emergency contact ---- */
  if (!a.emergencyName) return fail('emergency_name', 'Emergency contact is required.');
  a.emergencyPhone = phone(b.emergencyPhone);
  if (!a.emergencyPhone) return fail('emergency_phone', 'Emergency contact phone must have 7 to 15 digits.');
  if (!a.emergencyRelationship) return fail('emergency_relationship', 'Relationship is required.');

  if (b.waiverAccepted !== true) return fail('waiver', 'You must accept the waiver.');

  // Sharing with scouts is a separate, optional permission. Anything other
  // than an explicit true is a no.
  a.consentShare = yes(b.consentShare);

  // The typed signature. Under 18 it must be a parent or legal guardian, who
  // is then also the person recorded as accepting the waiver.
  if (!a.signatureName) return fail('signature', 'Type your full name to sign.');
  a.guardianName = a.isMinor ? a.signatureName : '';

  // Under 13 the form has to be filled by a parent or guardian, who gives
  // their own email and says plainly that it is them.
  a.isChild = age < CHILD_AGE;
  if (a.isChild) {
    if (!EMAIL_RE.test(a.parentEmail)) {
      return fail('parent_email', "A parent or guardian's email is required for players under " + CHILD_AGE + '.');
    }
    if (b.parentConfirm !== true) {
      return fail('parent_confirm', 'A parent or guardian must confirm they are filling this form.');
    }
  } else {
    a.parentEmail = '';
  }
  a.parentConfirmed = a.isChild;

  a.profile = p;
  return { application: a };
}
