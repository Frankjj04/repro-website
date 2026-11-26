/* Rate limits shared by every serverless instance (security pass, 2026-11-26).

   Counts live in Postgres, so a script cannot dodge them by landing on a
   fresh instance. One atomic UPSERT per hit: parallel requests can't
   overwrite each other's increments.

     const r = await hit(query, 'login', ip, 10, 15 * 60);
     if (!r.ok) return tooMany(res, r);

   failClosed: on a database error, refuse (logins) instead of allowing
   (sign-up forms, where an outage must not block real people). */

const TABLE = `
CREATE TABLE IF NOT EXISTS rate_hits (
  bucket       TEXT        NOT NULL,
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  n            INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window_start)
)`;

let ready = null;
function ensure(query) {
  if (!ready) ready = query(TABLE).catch((e) => { ready = null; throw e; });
  return ready;
}

export function ipOf(req) {
  const h = req.headers || {};
  // On Vercel both headers are set by the platform from the real connection;
  // a client cannot forge them.
  return String(h['x-real-ip'] || h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export async function hit(query, bucket, key, limit, windowSec, { failClosed = false } = {}) {
  try {
    await ensure(query);
    const { rows } = await query(
      `INSERT INTO rate_hits (bucket, key, window_start, n)
       VALUES ($1, $2, to_timestamp(floor(extract(epoch FROM now()) / $3) * $3), 1)
       ON CONFLICT (bucket, key, window_start) DO UPDATE SET n = rate_hits.n + 1
       RETURNING n, extract(epoch FROM (window_start + make_interval(secs => $3) - now()))::int AS retry`,
      [bucket, String(key).slice(0, 200), windowSec]);
    // Now and then, forget windows older than a day.
    if (Math.random() < 0.02) query(`DELETE FROM rate_hits WHERE window_start < now() - interval '1 day'`).catch(() => {});
    const n = rows[0].n;
    return { ok: n <= limit, n, retryAfter: Math.max(1, rows[0].retry) };
  } catch (err) {
    console.error('rate limit check failed (' + bucket + '):', err && err.message);
    return { ok: !failClosed, n: 0, retryAfter: 60 };
  }
}

export function tooMany(res, r, message = 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.') {
  res.setHeader('Retry-After', String(r.retryAfter || 60));
  return res.status(429).json({ error: 'too_many', code: 'too_many', message });
}
