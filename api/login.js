/* POST   /api/login  — exchange the shared password for a session cookie
   DELETE /api/login  — sign out
   GET    /api/login  — is this browser signed in? */

import { checkPassword, issueCookie, clearCookie, isSignedIn, isConfigured }
  from '../lib/auth.js';
import { clientIp, readAttempts, saveAttempts, nextState, LOCK_MINUTES }
  from '../lib/lockout.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ signedIn: isSignedIn(req), configured: isConfigured() });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'not_configured',
      message: 'Falta configurar ADMIN_PASSWORD en el proyecto.',
    });
  }

  const password = (req.body && req.body.password) || '';
  const ip = clientIp(req);
  const row = await readAttempts(ip);
  const ok = checkPassword(password);
  const state = nextState(row, ok);

  await saveAttempts(ip, state);

  // Already locked from earlier tries: the password is not even considered.
  if (state.locked && !ok) {
    await new Promise((r) => setTimeout(r, 600));
    return res.status(429).json({
      error: 'locked',
      message: 'Demasiados intentos. Espera ' + state.minutesLeft +
        (state.minutesLeft === 1 ? ' minuto' : ' minutos') + ' e inténtalo otra vez.',
    });
  }

  if (!ok) {
    // A small delay blunts guessing even before the lock kicks in.
    await new Promise((r) => setTimeout(r, 600));
    const left = Math.max(0, 5 - state.fails);
    return res.status(401).json({
      error: 'bad_password',
      message: left <= 2
        ? 'Contraseña incorrecta. Te quedan ' + left + (left === 1 ? ' intento' : ' intentos') +
          ' antes de esperar ' + LOCK_MINUTES + ' minutos.'
        : 'Contraseña incorrecta.',
    });
  }

  res.setHeader('Set-Cookie', issueCookie());
  return res.status(200).json({ ok: true });
}
