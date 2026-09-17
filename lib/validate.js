/* What counts as a valid application. Every refusal carries a code, which the
   sign-up page turns into a message in the player's language on the right
   field. Add a code here → add it to REFUSALS in js/registro.js too (a test
   checks). */

import { EVENTS, POSITIONS, STRONG_LEG, MINOR_AGE } from '../js/registro-config.js';

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
    guardianName:  clean(b.guardianName, 100),
  };

  const event = EVENTS.find((e) => e.id === a.event);
  if (!event) return fail('event', 'Choose an event.');
  if (!event.open) return fail('event_closed', 'Applications for this event are closed.');

  if (!a.name) return fail('name', 'Full name is required.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dob)) return fail('dob', 'Date of birth is required.');
  const age = ageOn(a.dob);
  if (age === null || age < 6 || age > 60) return fail('dob_bad', 'That date of birth does not look right.');

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

  a.videoUrl = videoUrl(b.videoUrl);
  if (a.videoUrl === null) return fail('video_url', 'That video link does not look right.');

  if (!a.emergencyName) return fail('emergency_name', 'Emergency contact is required.');
  a.emergencyPhone = phone(b.emergencyPhone);
  if (!a.emergencyPhone) return fail('emergency_phone', 'Emergency contact phone must have 7 to 15 digits.');
  if (!a.emergencyRelationship) return fail('emergency_relationship', 'Relationship is required.');

  a.isMinor = age < MINOR_AGE;
  if (a.isMinor) {
    if (!a.guardianName) return fail('guardian_name', 'A parent or guardian must accept the waiver for a player under 18.');
  } else {
    a.guardianName = '';
  }

  if (b.waiverAccepted !== true) return fail('waiver', 'You must accept the waiver.');

  return { application: a };
}
