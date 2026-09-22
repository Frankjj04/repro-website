/* POST /api/register — a player applying to a scouting event. */

import { query, isConfigured } from '../lib/db.js';
import { validateApplication, decodePhoto, clean } from '../lib/validate.js';
import { WAIVER_VERSION, CONSENT_VERSION } from '../js/registro-config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: 'not_configured',
      message: 'Registration is not connected yet.' });
  }

  // Honeypot: a real person never fills a field they cannot see. Answer 200 so
  // a bot cannot tell it was caught.
  if (clean((req.body || {}).website, 80)) return res.status(200).json({ ok: true });

  const { application: a, code, error } = validateApplication(req.body);
  if (error) return res.status(400).json({ error: 'invalid', code, message: error });

  // Every player sends a headshot so the coach can put a face to the name.
  if (!req.body.photo) return res.status(400).json({ error: 'invalid', code: 'photo_missing', message: 'A headshot is required.' });
  const photo = decodePhoto(req.body.photo);
  if (photo.code) return res.status(400).json({ error: 'invalid', code: photo.code, message: 'The headshot could not be used.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
  const userAgent = clean(req.headers['user-agent'], 300);
  const lang = req.body.lang === 'en' ? 'en' : 'es';
  const now = new Date();          // our clock, not the browser's

  try {
    const { rows } = await query(
      `INSERT INTO applicants
         (event, name, dob, birthplace, nationalities, phone, email, height, weight,
          mls_next, strong_leg, position_primary, position_secondary, video_url,
          emergency_name, emergency_phone, emergency_relationship, guardian_name,
          waiver_version, waiver_accepted_at, ip, photo, photo_type,
          signature_name, consent_share, consent_share_at, consent_version, form_lang, user_agent,
          parent_email, parent_confirmed_at, parent_confirm_source,
          instagram, tiktok)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
               $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
       RETURNING id`,
      [a.event, a.name, a.dob, a.birthplace, a.nationalities, a.phone, a.email, a.height, a.weight,
       a.mlsNext, a.strongLeg, a.positionPrimary, a.positionSecondary, a.videoUrl,
       a.emergencyName, a.emergencyPhone, a.emergencyRelationship, a.guardianName,
       WAIVER_VERSION, now, ip, photo.buf, photo.type,
       a.signatureName, a.consentShare, a.consentShare ? now : null,
       a.consentShare ? CONSENT_VERSION : '', lang, userAgent,
       a.parentEmail || '', a.parentConfirmed ? now : null, a.parentConfirmed ? 'form' : '',
       a.instagram || '', a.tiktok || '']
    );
    return res.status(201).json({ ok: true, id: Number(rows[0].id) });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'duplicate',
        message: 'This email has already applied to this event.' });
    }
    console.error('register failed:', err);
    return res.status(500).json({ error: 'server_error',
      message: 'We could not save your application.' });
  }
}
