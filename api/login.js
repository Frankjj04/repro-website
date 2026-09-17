/* POST   /api/login  — exchange the shared password for a session cookie
   DELETE /api/login  — sign out
   GET    /api/login  — is this browser signed in? */

import { checkPassword, issueCookie, clearCookie, isSignedIn, isConfigured }
  from '../lib/auth.js';

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

  if (!checkPassword(password)) {
    // A small delay blunts guessing without needing shared state between
    // serverless instances.
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: 'bad_password', message: 'Contraseña incorrecta.' });
  }

  res.setHeader('Set-Cookie', issueCookie());
  return res.status(200).json({ ok: true });
}
