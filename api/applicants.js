/* GET /api/applicants — every application, for the coach's admin page only.
   ?archived=1 returns removed applicants instead. */

import { query, isConfigured } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;
  if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });

  const archived = req.query && (req.query.archived === '1' || req.query.archived === 'true');

  try {
    const { rows } = await query(
      `SELECT ${COLUMNS} FROM applicants
        WHERE deleted_at IS ${archived ? 'NOT NULL' : 'NULL'}
        ORDER BY ${archived ? 'deleted_at DESC' : 'created_at DESC'}`
    );
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(rows.map(toJson));
  } catch (err) {
    console.error('applicants failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

/* Everything except the photo bytes, which are fetched one at a time from
   /api/photo — inlining them would make the list enormous. */
export const COLUMNS = `id, event, name, dob, birthplace, nationalities, phone, email, height, weight,
  mls_next, strong_leg, position_primary, position_secondary, video_url,
  emergency_name, emergency_phone, emergency_relationship, guardian_name,
  waiver_version, waiver_accepted_at, status, coach_note, created_at, deleted_at,
  signature_name, consent_share, consent_share_at, consent_version, consent_withdrawn_at, form_lang,
  parent_email, parent_confirmed_at,
  (photo IS NOT NULL) AS has_photo`;

export function toJson(r) {
  return {
    id: Number(r.id),
    event: r.event,
    name: r.name,
    dob: r.dob instanceof Date ? r.dob.toISOString().slice(0, 10) : String(r.dob),
    birthplace: r.birthplace,
    nationalities: r.nationalities,
    phone: r.phone,
    email: r.email,
    height: r.height,
    weight: r.weight,
    mlsNext: r.mls_next,
    strongLeg: r.strong_leg,
    positionPrimary: r.position_primary,
    positionSecondary: r.position_secondary,
    videoUrl: r.video_url,
    emergencyName: r.emergency_name,
    emergencyPhone: r.emergency_phone,
    emergencyRelationship: r.emergency_relationship,
    guardianName: r.guardian_name,
    waiverVersion: r.waiver_version,
    waiverAcceptedAt: r.waiver_accepted_at,
    photo: r.has_photo ? '/api/photo?id=' + r.id : '',
    signatureName: r.signature_name,
    consentShare: r.consent_share,
    consentShareAt: r.consent_share_at,
    consentVersion: r.consent_version,
    consentWithdrawnAt: r.consent_withdrawn_at,
    formLang: r.form_lang,
    parentEmail: r.parent_email,
    parentConfirmedAt: r.parent_confirmed_at,
    status: r.status,
    note: r.coach_note,
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
  };
}
