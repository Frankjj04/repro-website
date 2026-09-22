/* Tests for everything that does not need a database: validation, refusals,
   the password gate, and that every refusal the server can send has a
   translated message on the sign-up page.

   Run: npm test */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.DATABASE_URL = 'postgres://test/test';
process.env.ADMIN_PASSWORD = 'correct-horse';
process.env.SESSION_SECRET = 'test-secret-not-a-real-one';

const { default: register } = await import('../api/register.js');
const { default: applicant } = await import('../api/applicant.js');
const { default: applicants } = await import('../api/applicants.js');
const auth = await import('../lib/auth.js');
const { validateApplication, videoUrl, phone, handle } = await import('../lib/validate.js');
const { REFUSALS } = await import('../js/registro.js');
const { default: invite } = await import('../api/invite.js');
const { default: permiso } = await import('../api/permiso.js');
const { buildInvite, asksFor } = await import('../lib/invite.js');
const { missingDetails, cleanPayment, isReady, EMPTY } = await import('../lib/settings.js');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ok   ' + name); passed++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); failed++; }
}

function mockRes() {
  const r = { statusCode: 0, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}

const yearsAgo = (n) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  d.setUTCDate(d.getUTCDate() - 3);
  return d.toISOString().slice(0, 10);
};

const adult = () => ({
  event: 'nov-10-11',
  name: '  Jugador   De Prueba ',
  dob: '2006-04-10',
  birthplace: 'Guadalajara, México',
  nationalities: 'México, USA',
  phone: '+52 33 1234 5678',
  email: 'Prueba@Example.com',
  height: '1.78 m',
  weight: '72 kg',
  mlsNext: false,
  strongLeg: 'right',
  positionPrimary: 'CM',
  positionSecondary: 'CAM',
  videoUrl: 'youtu.be/abc123',
  emergencyName: 'María López',
  emergencyPhone: '702-555-0100',
  emergencyRelationship: 'Mother',
  waiverAccepted: true,
  signatureName: 'Jugador De Prueba',
  website: '',
});

async function post(body) {
  const res = mockRes();
  await register({ method: 'POST', body, headers: {} }, res);
  return res;
}

console.log('validation');

await test('a complete adult application is valid and normalised', () => {
  const { application: a, error } = validateApplication(adult());
  assert.equal(error, undefined);
  assert.equal(a.name, 'Jugador De Prueba');
  assert.equal(a.email, 'prueba@example.com');
  assert.equal(a.phone, '+523312345678');
  assert.equal(a.emergencyPhone, '7025550100');
  assert.equal(a.videoUrl, 'https://youtu.be/abc123');
  assert.equal(a.isMinor, false);
  assert.equal(a.guardianName, '');
  assert.equal(a.consentShare, false);
});

await test('permission to share only counts as an explicit true', () => {
  assert.equal(validateApplication({ ...adult(), consentShare: 'true' }).application.consentShare, false);
  assert.equal(validateApplication({ ...adult(), consentShare: true }).application.consentShare, true);
});

await test('video link is optional: players may send it on WhatsApp instead', () => {
  const r = validateApplication({ ...adult(), videoUrl: '' });
  assert.equal(r.code, undefined);
  assert.equal(r.application.videoUrl, '');
});

await test('dangerous or broken video links are refused', () => {
  assert.equal(videoUrl('javascript:alert(1)'), null);
  assert.equal(videoUrl('data:text/html,hi'), null);
  assert.equal(videoUrl('not a link'), null);
  assert.equal(videoUrl('https://www.hudl.com/video/3/1'), 'https://www.hudl.com/video/3/1');
});

await test('international phones: 7 to 15 digits', () => {
  assert.equal(phone('123456'), null);
  assert.equal(phone('+1234567890123456'), null);
  assert.equal(phone('+421 905 123 456'), '+421905123456');
});

for (const [field, value, code] of [
  ['event', 'nope', 'event'],
  ['name', '', 'name'],
  ['dob', '', 'dob'],
  ['dob', '1800-01-01', 'dob_bad'],
  ['birthplace', '', 'birthplace'],
  ['nationalities', ' ', 'nationalities'],
  ['phone', '12', 'phone'],
  ['email', 'x@y', 'email'],
  ['height', '', 'height'],
  ['weight', '', 'weight'],
  ['mlsNext', 'yes', 'mls_next'],
  ['strongLeg', 'middle', 'strong_leg'],
  ['positionPrimary', 'QB', 'position_primary'],
  ['positionSecondary', '', 'position_secondary'],
  ['videoUrl', 'javascript:x', 'video_url'],
  ['emergencyName', '', 'emergency_name'],
  ['emergencyPhone', '', 'emergency_phone'],
  ['emergencyRelationship', '', 'emergency_relationship'],
  ['waiverAccepted', 'true', 'waiver'],
  ['signatureName', '  ', 'signature'],
]) {
  await test(`refuses bad ${field} with code ${code}`, () => {
    assert.equal(validateApplication({ ...adult(), [field]: value }).code, code);
  });
}

await test('each date takes only its own birth years, both ends included', () => {
  // The coach: 2003-2008, 2008-2011, 2011-2014 — nobody older, nobody younger.
  // Players under 13 also need the parent fields; this test is about the years.
  const check = (event, dob) => validateApplication({ ...adult(), event, dob, signatureName: 'A B',
    parentEmail: 'mama@ejemplo.com', parentConfirm: true });
  for (const [event, ok, bad] of [
    ['nov-10-11', ['2003-01-01', '2008-12-31'], ['2002-12-31', '2009-01-01']],
    ['nov-17-18', ['2008-01-01', '2011-12-31'], ['2007-12-31', '2012-01-01']],
    ['nov-24-25', ['2011-01-01', '2014-12-31'], ['2010-12-31', '2015-01-01']],
  ]) {
    for (const dob of ok) assert.equal(check(event, dob).error, undefined, event + ' ' + dob);
    for (const dob of bad) assert.equal(check(event, dob).code, 'event_age', event + ' ' + dob);
  }
});

await test('for a minor, the person signing is recorded as the guardian', () => {
  const ok = validateApplication({ ...adult(), event: 'nov-17-18', dob: '2010-03-02', signatureName: 'Ana Pérez' });
  assert.equal(ok.application.isMinor, true);
  assert.equal(ok.application.guardianName, 'Ana Pérez');
});

await test('an adult signs for themselves; no guardian is recorded', () => {
  assert.equal(validateApplication({ ...adult(), guardianName: 'X' }).application.guardianName, '');
});

console.log('register endpoint');

await test('GET is refused', async () => {
  const res = mockRes();
  await register({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

await test('honeypot answers 200 without saving', async () => {
  const res = await post({ ...adult(), website: 'spam.example' });
  assert.equal(res.statusCode, 200);
});

// A real 1x1 JPEG, so the magic-byte check sees genuine bytes.
const JPEG_1PX = 'data:image/jpeg;base64,' +
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

await test('a headshot is required', async () => {
  const res = await post({ ...adult() });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'photo_missing');
});

await test('a file that is not an image is refused as the headshot', async () => {
  const fake = 'data:image/jpeg;base64,' + Buffer.from('<html>not a photo</html>').toString('base64');
  const res = await post({ ...adult(), photo: fake });
  assert.equal(res.body.code, 'photo_type');
});

await test('a real JPEG passes the photo check', async () => {
  const { decodePhoto } = await import('../lib/validate.js');
  assert.equal(decodePhoto(JPEG_1PX).type, 'image/jpeg');
});

await test('photos need the password', async () => {
  const { default: photo } = await import('../api/photo.js');
  const res = mockRes();
  await photo({ method: 'GET', headers: {}, query: { id: '1' } }, res);
  assert.equal(res.statusCode, 401);
});

await test('refusals carry a code', async () => {
  const res = await post({ ...adult(), waiverAccepted: false });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'waiver');
});

console.log('admin endpoints');

await test('applicants list needs the password', async () => {
  const res = mockRes();
  await applicants({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 401);
});

await test('changing an applicant needs the password', async () => {
  const res = mockRes();
  await applicant({ method: 'PATCH', headers: {}, query: { id: '1' }, body: { status: 'selected' } }, res);
  assert.equal(res.statusCode, 401);
});

await test('a forged cookie is refused', () => {
  const req = { headers: { cookie: 'bepro_admin=' + (Date.now() + 99999) + '.deadbeef' } };
  assert.equal(auth.isSignedIn(req), false);
});

await test('a real cookie is accepted, and it is a session cookie', () => {
  const set = auth.issueCookie();
  assert.ok(!/Max-Age/i.test(set));
  const req = { headers: { cookie: set.split(';')[0] } };
  assert.equal(auth.isSignedIn(req), true);
});

await test('signed in: a bad status is refused before touching the database', async () => {
  const cookie = auth.issueCookie().split(';')[0];
  const res = mockRes();
  await applicant({ method: 'PATCH', headers: { cookie }, query: { id: '1' }, body: { status: 'maybe' } }, res);
  assert.equal(res.statusCode, 400);
});

await test("signed in: a bad parent email is refused before touching the database", async () => {
  const cookie = auth.issueCookie().split(';')[0];
  const res = mockRes();
  await applicant({ method: 'PATCH', headers: { cookie }, query: { id: '1' },
    body: { parentEmail: 'not-an-email', parentConfirm: true } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'parent_email');
});

await test('signed in: a bad video link is refused before touching the database', async () => {
  const cookie = auth.issueCookie().split(';')[0];
  for (const bad of ['javascript:alert(1)', 'not a link', '']) {
    const res = mockRes();
    await applicant({ method: 'PATCH', headers: { cookie }, query: { id: '1' }, body: { videoUrl: bad } }, res);
    assert.equal(res.statusCode, 400, bad);
    assert.equal(res.body.error, 'video_url', bad);
  }
});

await test('signed in: recording a parent permission needs the box ticked', async () => {
  const cookie = auth.issueCookie().split(';')[0];
  const res = mockRes();
  await applicant({ method: 'PATCH', headers: { cookie }, query: { id: '1' },
    body: { parentEmail: 'mama@ejemplo.com', parentConfirm: false } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'parent_confirm');
});

console.log('sharing');

const { default: shares } = await import('../api/shares.js');
const { default: share } = await import('../api/share.js');
const { default: sharePhoto } = await import('../api/share-photo.js');
const { scoutProfile, isToken } = await import('../lib/scout.js');

await test('managing share links needs the password', async () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    const res = mockRes();
    await shares({ method, headers: {}, query: {}, body: {} }, res);
    assert.equal(res.statusCode, 401, method);
  }
});

await test('the coach cannot grant permission on a player\'s behalf', async () => {
  const cookie = auth.issueCookie().split(';')[0];
  const res = mockRes();
  await applicant({ method: 'PATCH', headers: { cookie }, query: { id: '1' }, body: { consentShare: true } }, res);
  assert.equal(res.statusCode, 400);
});

await test('a malformed share token is refused before touching the database', async () => {
  for (const t of [undefined, '', 'abc', 'x'.repeat(43) + '!', "' OR 1=1 --"]) {
    const res = mockRes();
    await share({ method: 'GET', headers: {}, query: { t } }, res);
    assert.equal(res.statusCode, 404);
    const res2 = mockRes();
    await sharePhoto({ method: 'GET', headers: {}, query: { t, id: '1' } }, res2);
    assert.equal(res2.statusCode, 404);
  }
  assert.ok(isToken('A'.repeat(43)));
});

await test('a scout profile never carries contact, emergency, guardian, notes or exact birth date', () => {
  const row = {
    id: 7, name: 'X', dob: new Date('2008-05-04T00:00:00Z'), birthplace: 'B', nationalities: 'N',
    height: 'h', weight: 'w', mls_next: true, strong_leg: 'left', position_primary: 'ST',
    position_secondary: 'LW', video_url: 'https://v.example', status: 'selected', has_photo: true,
    phone: '+1', email: 'e@x.com', emergency_name: 'E', emergency_phone: '1', guardian_name: 'G', coach_note: 'secret',
  };
  const p = scoutProfile(row, 'A'.repeat(43));
  const json = JSON.stringify(p);
  for (const leak of ['+1', 'e@x.com', 'secret', '2008-05-04', '"G"', '"E"', 'selected']) assert.ok(!json.includes(leak), leak);
  assert.equal(p.birthYear, '2008');
  assert.deepEqual(Object.keys(p).sort(), ['age', 'birthYear', 'birthplace', 'height', 'id', 'mlsNext',
    'name', 'nationalities', 'photo', 'positionPrimary', 'positionSecondary', 'strongLeg', 'videoUrl', 'weight']);
});

console.log('sign-up page');

const validateSrc = readFileSync(new URL('../lib/validate.js', import.meta.url), 'utf8');
const serverCodes = new Set([...validateSrc.matchAll(/fail\('([a-z_]+)'/g)].map((m) => m[1]));
['photo_missing', 'photo_bad', 'photo_big', 'photo_type'].forEach((c) => serverCodes.add(c));
serverCodes.add('duplicate').add('server_error').add('not_configured');

await test('every server refusal code has a message on the sign-up page', () => {
  const missing = [...serverCodes].filter((c) => !REFUSALS[c]);
  assert.deepEqual(missing, []);
});

await test('every rg_ key used exists in Spanish and English', () => {
  const i18nSrc = readFileSync(new URL('../js/i18n.js', import.meta.url), 'utf8')
    .replace("document.addEventListener('DOMContentLoaded', () => I18N.init());", '');
  const T = new Function(i18nSrc + '; return BEPRO_TRANSLATIONS;')();
  const pages = ['../registro.html', '../js/registro.js']
    .map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n');
  const used = new Set([...pages.matchAll(/['"](rg_[a-z0-9_]+)['"]/g)].map((m) => m[1]));
  for (const lang of ['es', 'en']) {
    const missing = [...used].filter((k) => T[lang][k] === undefined);
    assert.deepEqual(missing, [], lang + ' is missing keys');
  }
});

/* ---------- under 13: a parent fills the form ---------- */
const childDob = () => '2014-01-15';   // 11 or 12 years old, inside the nov-24-25 years

await test('under 13 needs a parent email and their confirmation', () => {
  const base = { ...adult(), dob: childDob(), event: 'nov-24-25' };
  assert.equal(validateApplication(base).code, 'parent_email');
  assert.equal(validateApplication({ ...base, parentEmail: 'mama@ejemplo.com' }).code, 'parent_confirm');
  const ok = validateApplication({ ...base, parentEmail: 'Mama@Ejemplo.com', parentConfirm: true });
  assert.equal(ok.code, undefined);
  assert.equal(ok.application.parentEmail, 'mama@ejemplo.com');
  assert.equal(ok.application.parentConfirmed, true);
});

await test('13 and over does not ask for a parent email', () => {
  const a = validateApplication(adult()).application;
  assert.equal(a.parentEmail, '');
  assert.equal(a.parentConfirmed, false);
});

/* ---------- sign-in lockout ---------- */
const { nextState, clientIp, MAX_FAILS, LOCK_MINUTES } = await import('../lib/lockout.js');

await test('wrong tries add up and then lock the address', () => {
  const now = new Date('2026-09-19T20:00:00Z');
  let row = null;
  for (let i = 1; i < MAX_FAILS; i++) {
    const st = nextState(row, false, now);
    assert.equal(st.fails, i);
    assert.equal(st.locked, false);
    row = { fails: st.fails, locked_until: st.lockedUntil };
  }
  const last = nextState(row, false, now);
  assert.equal(last.locked, true);
  assert.equal(last.minutesLeft, LOCK_MINUTES);
});

await test('while locked, even the right password is refused', () => {
  const now = new Date('2026-09-19T20:00:00Z');
  const row = { fails: MAX_FAILS, locked_until: new Date('2026-09-19T20:10:00Z') };
  assert.equal(nextState(row, true, now).locked, true);
  assert.equal(nextState(row, false, now).minutesLeft, 10);
});

await test('the lock runs out and the count starts over', () => {
  const now = new Date('2026-09-19T20:20:00Z');
  const row = { fails: MAX_FAILS, locked_until: new Date('2026-09-19T20:10:00Z') };
  const st = nextState(row, false, now);
  assert.equal(st.locked, false);
  assert.equal(st.fails, 1);
});

await test('the right password clears the count', () => {
  const st = nextState({ fails: 3, locked_until: null }, true);
  assert.equal(st.fails, 0);
  assert.equal(st.locked, false);
});

await test('the client address is the first one in x-forwarded-for', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 70.1.1.1' } }), '203.0.113.7');
  assert.equal(clientIp({ headers: {} }), 'unknown');
});

/* ---------- the invitation email ---------- */

const invitee = (over = {}) => ({
  id: 7, event: 'nov-24-25', name: 'Diego Martínez López', dob: '2014-05-02',
  email: 'diego@example.com', formLang: 'es', videoUrl: '', status: 'selected',
  parentConfirmedAt: null, parentEmail: '', invitedAt: null, inviteCount: 0, ...over,
});

await test('the email asks for what this player is actually missing', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  // 12 years old, nobody gave permission, no video: both asks.
  assert.deepEqual(asksFor(invitee(), now), { parent: true, video: true });
  // Permission on record: only the video.
  assert.deepEqual(asksFor(invitee({ parentConfirmedAt: '2026-09-20T00:00:00Z' }), now),
    { parent: false, video: true });
  // A 17-year-old is not a child: never the parent block, whatever we hold.
  assert.deepEqual(asksFor(invitee({ dob: '2008-05-02', videoUrl: 'https://v.example' }), now),
    { parent: false, video: false });
});

await test('the invitation is written in the language the player used', () => {
  const es = buildInvite(invitee());
  const en = buildInvite(invitee({ formLang: 'en' }));
  assert.equal(es.lang, 'es');
  assert.match(es.subject, /Estás invitado/);
  assert.match(es.text, /Hola Diego,/);
  assert.equal(en.lang, 'en');
  assert.match(en.subject, /You're invited/);
  assert.match(en.text, /Hi Diego,/);
});

await test('the permission block appears only when a link was made for it', () => {
  const without = buildInvite(invitee());
  assert.equal(/permiso\.html/.test(without.text), false);

  const with_ = buildInvite(invitee(), { parentLink: 'https://bepro.futbol/permiso.html?t=abc' });
  assert.match(with_.text, /permiso\.html\?t=abc/);
  assert.match(with_.html, /permiso\.html\?t=abc/);

  // A player old enough never gets it, even if a link is passed by mistake.
  const grown = buildInvite(invitee({ dob: '2008-05-02' }), { parentLink: 'https://x/permiso.html?t=abc' });
  assert.equal(/permiso\.html/.test(grown.text), false);
});

await test('the video block appears only when we have no link', () => {
  assert.match(buildInvite(invitee()).text, /wa\.me/);
  const has = buildInvite(invitee({ videoUrl: 'https://youtu.be/abc' }));
  assert.equal(/NOS FALTA TU VIDEO/.test(has.text), false);
});

await test('a name with html in it cannot break out into the email', () => {
  const mail = buildInvite(invitee({ name: '<script>alert(1)</script> Pérez' }));
  assert.equal(mail.html.includes('<script>'), false);
  assert.match(mail.html, /&lt;script&gt;/);
});

await test('the email refuses to go out while the payment details are missing', () => {
  // Nothing typed yet: a half-written email about money must never reach a
  // family, so every missing piece is named.
  const empty = cleanPayment({});
  assert.equal(isReady(empty), false);
  assert.ok(missingDetails(empty).some((m) => m.startsWith('el costo del')));
  assert.ok(missingDetails(empty).some((m) => m.startsWith('cómo se paga')));

  // Everything filled in: ready.
  const full = cleanPayment({
    methods: [{ label: 'Zelle', detail: 'pagos@bepro.futbol' }],
    deadline: { es: '1 de noviembre', en: 'November 1' },
    refund: { es: 'No hay devoluciones.', en: 'No refunds.' },
    logistics: {
      'nov-10-11': { venue: 'Cancha A', time: '9:00 AM', price: '$365' },
      'nov-17-18': { venue: 'Cancha A', time: '9:00 AM', price: '$365' },
      'nov-24-25': { venue: 'Cancha A', time: '9:00 AM', price: '$95' },
    },
  });
  assert.deepEqual(missingDetails(full), []);
  assert.equal(isReady(full), true);
});

await test("the coach's typing is cleaned before it can reach an email", () => {
  const p = cleanPayment({
    methods: [{ label: 'Zelle', detail: 'x'.repeat(500) }, { label: '', detail: '' }],
    bring: { es: ['Agua', '', '  Botines '], en: [] },
    logistics: { 'nov-10-11': { venue: 'Cancha A', time: '9 AM' }, 'no-such-event': { venue: 'x' } },
  });
  assert.equal(p.methods.length, 1);
  assert.equal(p.methods[0].detail.length, 200);
  assert.deepEqual(p.bring.es, ['Agua', 'Botines']);
  assert.equal(p.logistics['no-such-event'], undefined);
  assert.equal(p.logistics['nov-10-11'].venue, 'Cancha A');
});

await test('an empty settings object never crashes the email', () => {
  const mail = buildInvite(invitee(), { settings: EMPTY });
  assert.match(mail.text, /Hola Diego,/);
});

await test('signed out: the invitation endpoints say nothing at all', async () => {
  for (const method of ['GET', 'POST']) {
    const res = mockRes();
    await invite({ method, headers: {}, query: { id: '1' } }, res);
    assert.equal(res.statusCode, 401, method);
  }
});

await test('signed in: a bad id never reaches the database', async () => {
  const cookie = auth.issueCookie().split(';')[0];
  for (const id of ['0', '-3', 'abc', '']) {
    const res = mockRes();
    await invite({ method: 'GET', headers: { cookie }, query: { id } }, res);
    assert.equal(res.statusCode, 400, id);
    assert.equal(res.body.error, 'bad_id');
  }
});

/* ---------- the parent's permission link ---------- */

await test('a link that is not a real token is refused before any query', async () => {
  for (const t of ['', 'x', '../../etc/passwd', "' OR 1=1 --", 'a'.repeat(42)]) {
    const res = mockRes();
    await permiso({ method: 'GET', headers: {}, query: { t } }, res);
    assert.equal(res.statusCode, 404, JSON.stringify(t));
  }
});

await test('the permission page says who, and only who', async () => {
  const res = mockRes();
  await permiso({ method: 'POST', headers: {}, body: { t: 'a'.repeat(43), who: 'maybe' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'who');
});

await test('the permission page is never indexed or cached', async () => {
  const res = mockRes();
  await permiso({ method: 'GET', headers: {}, query: { t: 'x' } }, res);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers['X-Robots-Tag'], 'noindex, nofollow');
});


/* ---------- Instagram and TikTok ---------- */

await test('a social name is accepted however people paste it', () => {
  for (const given of ['diego10', '@diego10', 'instagram.com/diego10', 'https://www.instagram.com/diego10',
                       'https://instagram.com/diego10/', 'instagram.com/diego10?igsh=abc']) {
    assert.equal(handle(given, 'instagram.com/'), 'diego10', given);
  }
  assert.equal(handle('@diego.10_', 'tiktok.com/'), 'diego.10_');
  assert.equal(handle('tiktok.com/@diego10', 'tiktok.com/'), 'diego10');
});

await test('both social names are optional, and junk is refused', () => {
  const ok = validateApplication({ ...adult(), instagram: '', tiktok: '' });
  assert.equal(ok.code, undefined);
  assert.equal(ok.application.instagram, '');
  assert.equal(ok.application.tiktok, '');

  assert.equal(validateApplication({ ...adult(), instagram: 'two words' }).code, 'instagram');
  assert.equal(validateApplication({ ...adult(), tiktok: '<script>' }).code, 'tiktok');
});

await test('the social names are stored without the @ or the link', () => {
  const r = validateApplication({ ...adult(), instagram: '@Diego_10', tiktok: 'https://tiktok.com/@diego10' });
  assert.equal(r.application.instagram, 'Diego_10');
  assert.equal(r.application.tiktok, 'diego10');
});

await test('a checkout link on every date counts as a way to pay', () => {
  const base = {
    deadline: { es: '1 de noviembre', en: '' },
    refund: { es: 'No hay devoluciones.', en: '' },
    logistics: {
      'nov-10-11': { venue: 'Cancha A', time: '9 AM', price: '$365', payLink: 'https://buy.stripe.com/aaa' },
      'nov-17-18': { venue: 'Cancha A', time: '9 AM', price: '$365', payLink: 'https://buy.stripe.com/aaa' },
      'nov-24-25': { venue: 'Cancha A', time: '9 AM', price: '$95', payLink: 'https://buy.stripe.com/bbb' },
    },
  };
  // No Zelle, no transfer — just the links. That is enough.
  assert.deepEqual(missingDetails(cleanPayment(base)), []);

  // Drop one link and it is not: nobody on that date could pay.
  const short = JSON.parse(JSON.stringify(base));
  short.logistics['nov-24-25'].payLink = '';
  assert.ok(missingDetails(cleanPayment(short)).some((m) => m.startsWith('cómo se paga')));
});

await test('only an https link is ever put in front of a family', () => {
  const p = cleanPayment({
    logistics: {
      'nov-10-11': { payLink: 'https://buy.stripe.com/ok' },
      'nov-17-18': { payLink: 'javascript:alert(1)' },
      'nov-24-25': { payLink: 'buy.stripe.com/no-scheme' },
    },
  });
  assert.equal(p.logistics['nov-10-11'].payLink, 'https://buy.stripe.com/ok');
  assert.equal(p.logistics['nov-17-18'].payLink, '');
  assert.equal(p.logistics['nov-24-25'].payLink, '');
});

await test('the payment button carries that date\'s own link', () => {
  const settings = cleanPayment({
    amount: { es: '$120', en: '' },
    logistics: { 'nov-24-25': { venue: 'Cancha A', time: '9 AM', payLink: 'https://buy.stripe.com/bbb' } },
  });
  const mail = buildInvite(invitee(), { settings });
  assert.match(mail.text, /Pagar mi lugar: https:\/\/buy\.stripe\.com\/bbb/);
  assert.match(mail.html, /href="https:\/\/buy\.stripe\.com\/bbb"/);

  // A player on another date never sees it.
  const other = buildInvite(invitee({ event: 'nov-10-11', dob: '2008-05-02' }), { settings });
  assert.equal(/buy\.stripe\.com/.test(other.text), false);
});

await test('each date can cost a different amount', () => {
  const settings = cleanPayment({
    logistics: {
      'nov-10-11': { venue: 'Cancha A', time: '9 AM', price: '$365', payLink: 'https://buy.stripe.com/a' },
      'nov-17-18': { venue: 'Cancha A', time: '9 AM', price: '$365', payLink: 'https://buy.stripe.com/a' },
      'nov-24-25': { venue: 'Cancha B', time: '9 AM', price: '$95', payLink: 'https://buy.stripe.com/b' },
    },
  });
  // Each player is told their own date's price, never another one's.
  assert.match(buildInvite(invitee(), { settings }).text, /Costo: \$95/);
  assert.match(buildInvite(invitee({ event: 'nov-10-11', dob: '2008-05-02' }), { settings }).text,
    /Costo: \$365/);
});

await test('a price is needed on every date', () => {
  const each = cleanPayment({
    deadline: { es: '1 de noviembre', en: '' },
    refund: { es: 'No se devuelve.', en: '' },
    logistics: {
      'nov-10-11': { venue: 'A', time: '9', price: '$120', payLink: 'https://buy.stripe.com/a' },
      'nov-17-18': { venue: 'A', time: '9', price: '$120', payLink: 'https://buy.stripe.com/a' },
      'nov-24-25': { venue: 'B', time: '9', price: '$150', payLink: 'https://buy.stripe.com/b' },
    },
  });
  assert.deepEqual(missingDetails(each), []);

  // Take one price away and nothing covers that date.
  const gap = JSON.parse(JSON.stringify(each));
  gap.logistics['nov-17-18'].price = '';
  assert.ok(missingDetails(cleanPayment(gap)).some((m) => m.startsWith('el costo del')));
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
