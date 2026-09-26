/* The exact bytes of a request, for webhooks that check a signature over them
   (Stripe, Resend).

   On Vercel the request has already been read before a function runs, and only
   'data'/'end' listeners get the bytes again — `for await (… of req)` gets
   nothing, and an empty body never matches a signature. So: listeners, and
   never touch req.body (JSON arrives there already parsed, which is useless
   for a signature). */

export function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
