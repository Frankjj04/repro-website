/* Slows down password guessing on the coach's page.

   Wrong tries are counted per IP in the database — serverless instances do not
   share memory, so the count has to live somewhere both can see. After
   MAX_FAILS wrong tries the IP is refused for LOCK_MINUTES, whatever password
   it sends. A correct password clears the count.

   If the database is unreachable the gate opens rather than closes: the coach
   must still be able to sign in, and the password itself is still checked. */

import { query, isConfigured } from './db.js';

export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;

/* The whole decision, with no database and no clock of its own, so it can be
   tested directly. `row` is what the table holds for this IP (or null). */
export function nextState(row, passwordOk, now = new Date()) {
  const lockedUntil = row && row.locked_until ? new Date(row.locked_until) : null;

  if (lockedUntil && lockedUntil > now) {
    return { locked: true, lockedUntil, fails: row.fails, minutesLeft: minutesUntil(lockedUntil, now) };
  }

  // A lock that has run out starts the count fresh.
  const fails = lockedUntil ? 0 : (row ? row.fails : 0);

  if (passwordOk) return { locked: false, lockedUntil: null, fails: 0, minutesLeft: 0 };

  const next = fails + 1;
  if (next >= MAX_FAILS) {
    const until = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
    return { locked: true, lockedUntil: until, fails: next, minutesLeft: LOCK_MINUTES };
  }
  return { locked: false, lockedUntil: null, fails: next, minutesLeft: 0 };
}

export function minutesUntil(when, now = new Date()) {
  return Math.max(1, Math.ceil((when.getTime() - now.getTime()) / 60000));
}

/* The address the request came from. Vercel puts the real client first in
   x-forwarded-for; everything after it is a proxy. */
export function clientIp(req) {
  const fwd = String((req.headers && req.headers['x-forwarded-for']) || '');
  const first = fwd.split(',')[0].trim();
  return (first || (req.socket && req.socket.remoteAddress) || 'unknown').slice(0, 64);
}

export async function readAttempts(ip) {
  if (!isConfigured()) return null;
  try {
    const { rows } = await query('SELECT ip, fails, locked_until FROM login_attempts WHERE ip = $1', [ip]);
    return rows[0] || null;
  } catch (err) {
    console.error('lockout read failed:', err);
    return null;                       // fail open
  }
}

export async function saveAttempts(ip, state) {
  if (!isConfigured()) return;
  try {
    if (state.fails === 0) {
      await query('DELETE FROM login_attempts WHERE ip = $1', [ip]);
      return;
    }
    await query(
      `INSERT INTO login_attempts (ip, fails, locked_until, updated_at)
            VALUES ($1, $2, $3, NOW())
       ON CONFLICT (ip) DO UPDATE SET fails = $2, locked_until = $3, updated_at = NOW()`,
      [ip, state.fails, state.lockedUntil]);
  } catch (err) {
    console.error('lockout write failed:', err);
  }
}
