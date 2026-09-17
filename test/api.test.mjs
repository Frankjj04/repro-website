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
  event: 'final-oct-2026',
  name: '  Jugador   De Prueba ',
  dob: yearsAgo(20),
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
]) {
  await test(`refuses bad ${field} with code ${code}`, () => {
    assert.equal(validateApplication({ ...adult(), [field]: value }).code, code);
  });
}

await test('a minor needs a parent or guardian name', () => {
  const minor = { ...adult(), dob: yearsAgo(15) };
  assert.equal(validateApplication(minor).code, 'guardian_name');
  const ok = validateApplication({ ...minor, guardianName: 'Ana Pérez' });
  assert.equal(ok.application.isMinor, true);
  assert.equal(ok.application.guardianName, 'Ana Pérez');
});

await test('an adult\'s stray guardian name is dropped', () => {
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

console.log('sign-up page');

const validateSrc = readFileSync(new URL('../lib/validate.js', import.meta.url), 'utf8');
const serverCodes = new Set([...validateSrc.matchAll(/fail\('([a-z_]+)'/g)].map((m) => m[1]));
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
