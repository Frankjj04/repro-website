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
const { validateApplication, videoUrl, phone } = await import('../lib/validate.js');
const { REFUSALS } = await import('../js/registro.js');

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

await test('video link is optional', () => {
  assert.equal(validateApplication({ ...adult(), videoUrl: '' }).application.videoUrl, '');
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
  ['dob', '2013-01-01', 'event_age'],
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

await test('each event only takes its own birth years', () => {
  // 2010 belongs to Nov 17-18 (2008-2011), not to Nov 10-11 (2004-2008).
  assert.equal(validateApplication({ ...adult(), dob: '2010-06-01' }).code, 'event_age');
  assert.equal(validateApplication({ ...adult(), event: 'nov-17-18', dob: '2010-06-01' }).error, undefined);
  assert.equal(validateApplication({ ...adult(), event: 'nov-24-25', dob: '2013-05-05', signatureName: 'Ana Pérez' }).error, undefined);
  // The coach's ranges overlap at 2008 on purpose: that year fits two dates.
  assert.equal(validateApplication({ ...adult(), dob: '2008-09-09', signatureName: 'A B' }).error, undefined);
  assert.equal(validateApplication({ ...adult(), event: 'nov-17-18', dob: '2008-09-09', signatureName: 'A B' }).error, undefined);
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
