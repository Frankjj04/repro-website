/* The scout profile: exactly what a shared link shows, and nothing more.

   This is the one place that decides it. Phone, email, emergency contacts,
   the parent's name, the exact birth date and the coach's notes are left out
   on purpose — scouts contact Be Pro, not the player. */

export const SCOUT_COLUMNS = `id, name, dob, birthplace, nationalities, height, weight, mls_next,
  strong_leg, position_primary, position_secondary, video_url, (photo IS NOT NULL) AS has_photo`;

export function scoutProfile(r, token) {
  const dob = r.dob instanceof Date ? r.dob.toISOString().slice(0, 10) : String(r.dob);
  return {
    id: Number(r.id),
    name: r.name,
    birthYear: dob.slice(0, 4),
    age: ageFrom(dob),
    birthplace: r.birthplace,
    nationalities: r.nationalities,
    height: r.height,
    weight: r.weight,
    mlsNext: r.mls_next,
    strongLeg: r.strong_leg,
    positionPrimary: r.position_primary,
    positionSecondary: r.position_secondary,
    videoUrl: r.video_url,
    photo: r.has_photo ? '/api/share?t=' + encodeURIComponent(token) + '&photo=' + r.id : '',
  };
}

function ageFrom(dob) {
  const d = new Date(dob + 'T00:00:00Z');
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

/* A token is 32 random bytes as base64url: 43 characters. Anything else is
   rejected before touching the database. */
export const isToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

/* The live link for a token: exists, not turned off, not expired. */
export const LIVE_SHARE = `SELECT id, recipient, applicant_ids, expires_at FROM shares
  WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()`;

/* Who a live link may show right now: still in the link, not archived, and
   still consenting. Checked on every open, so withdrawing permission or
   archiving someone takes effect immediately. */
export const VISIBLE = `deleted_at IS NULL AND consent_share = true AND id = ANY($1::bigint[])`;
