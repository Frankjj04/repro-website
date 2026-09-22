/* What counts as a valid application. Every refusal carries a code, which the
   sign-up page turns into a message in the player's language on the right
   field. Add a code here → add it to REFUSALS in js/registro.js too (a test
   checks). */

import { EVENTS, POSITIONS, STRONG_LEG, MINOR_AGE, CHILD_AGE } from '../js/registro-config.js';

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

export function validateApplication(body) {
  const b = body || {};
  const fail = (code, error) => ({ code, error });

  const a = {
    event:         clean(b.event, 60),
    name:          clean(b.name, 100),
    dob:           clean(b.dob, 10),
    birthplace:    clean(b.birthplace, 120),
    nationalities: clean(b.nationalities, 120),
    email:         clean(b.email, 120).toLowerCase(),
    height:        clean(b.height, 20),
    weight:        clean(b.weight, 20),
    strongLeg:     clean(b.strongLeg, 10),
    positionPrimary:   clean(b.positionPrimary, 10),
    positionSecondary: clean(b.positionSecondary, 10),
    emergencyName:         clean(b.emergencyName, 100),
    emergencyRelationship: clean(b.emergencyRelationship, 60),
    signatureName: clean(b.signatureName, 100),
    parentEmail:   clean(b.parentEmail, 120).toLowerCase(),
  };

  const event = EVENTS.find((e) => e.id === a.event);
  if (!event) return fail('event', 'Choose an event.');
  if (!event.open) return fail('event_closed', 'Applications for this event are closed.');

  if (!a.name) return fail('name', 'Full name is required.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dob)) return fail('dob', 'Date of birth is required.');
  const age = ageOn(a.dob);
  if (age === null || age < 6 || age > 60) return fail('dob_bad', 'That date of birth does not look right.');

  // Each date takes only its own birth years — see js/registro-config.js.
  const born = Number(a.dob.slice(0, 4));
  if (born < event.years[0] || born > event.years[1]) {
    return fail('event_age', 'That date is only for players born ' + event.years[0] + '-' + event.years[1] + '.');
  }

  if (!a.birthplace) return fail('birthplace', 'Place of birth is required.');
  if (!a.nationalities) return fail('nationalities', 'Nationality is required.');

  a.phone = phone(b.phone);
  if (!a.phone) return fail('phone', 'Phone number must have 7 to 15 digits.');

  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a.email)) return fail('email', 'That email does not look right.');

  if (!a.height) return fail('height', 'Height is required.');
  if (!a.weight) return fail('weight', 'Weight is required.');

  if (b.mlsNext !== true && b.mlsNext !== false) return fail('mls_next', 'Answer the MLS NEXT question.');
  a.mlsNext = b.mlsNext;

  if (!STRONG_LEG.includes(a.strongLeg)) return fail('strong_leg', 'Choose your strong leg.');
  if (!POSITION_IDS.includes(a.positionPrimary)) return fail('position_primary', 'Choose your primary position.');
  if (!POSITION_IDS.includes(a.positionSecondary)) return fail('position_secondary', 'Choose your secondary position.');

  // Optional: some players cannot get a shareable link out of their phone, so
  // they send the video over WhatsApp instead. A link that IS given still has
  // to be a real http(s) link.
  a.videoUrl = videoUrl(b.videoUrl);
  if (a.videoUrl === null) return fail('video_url', 'That video link does not look right.');

  if (!a.emergencyName) return fail('emergency_name', 'Emergency contact is required.');
  a.emergencyPhone = phone(b.emergencyPhone);
  if (!a.emergencyPhone) return fail('emergency_phone', 'Emergency contact phone must have 7 to 15 digits.');
  if (!a.emergencyRelationship) return fail('emergency_relationship', 'Relationship is required.');

  if (b.waiverAccepted !== true) return fail('waiver', 'You must accept the waiver.');

  // Sharing with scouts is a separate, optional permission. Anything other
  // than an explicit true is a no.
  a.consentShare = b.consentShare === true;

  // The typed signature. Under 18 it must be a parent or legal guardian, who
  // is then also the person recorded as accepting the waiver.
  a.isMinor = age < MINOR_AGE;
  if (!a.signatureName) return fail('signature', 'Type your full name to sign.');
  a.guardianName = a.isMinor ? a.signatureName : '';

  // Under 13 the form has to be filled by a parent or guardian, who gives
  // their own email and says plainly that it is them.
  a.isChild = age < CHILD_AGE;
  if (a.isChild) {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a.parentEmail)) {
      return fail('parent_email', "A parent or guardian's email is required for players under " + CHILD_AGE + '.');
    }
    if (b.parentConfirm !== true) {
      return fail('parent_confirm', 'A parent or guardian must confirm they are filling this form.');
    }
  } else {
    a.parentEmail = '';
  }
  a.parentConfirmed = a.isChild;

  return { application: a };
}
