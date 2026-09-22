/* Sending mail, through Resend's HTTP API.

   Nothing here is Resend-specific except the URL and the body shape: if the
   provider ever changes, this one file changes with it.

   RESEND_API_KEY is what turns sending on. Without it the site behaves exactly
   as it does today — the admin page can still show the coach the email, it
   just cannot send it — so a missing key is never a crash. */

const ENDPOINT = 'https://api.resend.com/emails';

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/* Resolves to { id } on success. Throws with a message the coach can read:
   he is the one who will see it on screen. */
export async function sendEmail({ from, to, replyTo, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('email_not_configured');

  // A slow provider must not hold a serverless function open forever.
  const abort = AbortSignal.timeout(15_000);
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html, text }),
      signal: abort,
    });
  } catch (err) {
    throw new Error(err && err.name === 'TimeoutError' ? 'email_timeout' : 'email_unreachable');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Resend puts the useful part in `message`; keep it, the coach sees it.
    const detail = body && (body.message || body.name) ? ` — ${body.message || body.name}` : '';
    throw new Error(`email_refused_${res.status}${detail}`);
  }
  return { id: body && body.id ? String(body.id) : '' };
}
