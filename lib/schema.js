/* The database schema, as a static import so the serverless bundler always
   ships it. Every statement is IF NOT EXISTS, so applying it repeatedly is
   free — lib/db.js runs it once per warm instance. */

export const SCHEMA = `
-- BE PRO Futbol — scouting event applications

CREATE TABLE IF NOT EXISTS applicants (
  id                     BIGSERIAL PRIMARY KEY,

  -- Event id exactly as it appears in js/registro-config.js. Text, not a
  -- foreign key: an applicant's record must outlive the event being closed.
  event                  TEXT NOT NULL,

  name                   TEXT NOT NULL,
  dob                    DATE NOT NULL,
  birthplace             TEXT NOT NULL,
  nationalities          TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  email                  TEXT NOT NULL,

  -- Free text on purpose: players come from countries that measure in cm/kg
  -- and from ones that use feet and pounds.
  height                 TEXT NOT NULL,
  weight                 TEXT NOT NULL,

  mls_next               BOOLEAN NOT NULL,
  strong_leg             TEXT NOT NULL CHECK (strong_leg IN ('right', 'left', 'both')),
  position_primary       TEXT NOT NULL,
  position_secondary     TEXT NOT NULL,

  -- A link only. Videos are never uploaded here.
  video_url              TEXT NOT NULL DEFAULT '',

  emergency_name         TEXT NOT NULL,
  emergency_phone        TEXT NOT NULL,
  emergency_relationship TEXT NOT NULL,

  -- Filled only when the player is under 18: the waiver is accepted by a
  -- parent or legal guardian, and this is who.
  guardian_name          TEXT NOT NULL DEFAULT '',

  -- When the waiver was accepted is what matters if it is ever questioned,
  -- and which text they saw.
  waiver_version         TEXT NOT NULL,
  waiver_accepted_at     TIMESTAMPTZ NOT NULL,

  -- The coach's decision.
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'selected', 'not_selected')),
  coach_note             TEXT NOT NULL DEFAULT '',

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip                     TEXT,

  -- Removing an applicant only stamps this; they can be restored.
  deleted_at             TIMESTAMPTZ
);

-- Headshot, added September 2026. Downscaled in the player's browser before
-- upload (about 60–120 KB each). Only served behind the coach's password.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS photo BYTEA;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS photo_type TEXT NOT NULL DEFAULT 'image/jpeg';

-- Signature and permission to share, added September 2026.
-- signature_name: the full name typed as a signature — the player's own, or a
--   parent's or guardian's when the player is under 18.
-- consent_share: the player (or parent) allowed Be Pro to share their scout
--   profile with clubs, coaches, scouts and agencies. Only the person can grant
--   it; the coach can only withdraw it (consent_withdrawn_at).
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS signature_name TEXT NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS consent_share BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS consent_share_at TIMESTAMPTZ;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS consent_version TEXT NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS form_lang TEXT NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';

-- Players under 13: the parent or guardian's own email, and when they said
-- they were the one filling the form.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_email TEXT NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_confirmed_at TIMESTAMPTZ;
-- 'form' when the parent filled the sign-up form themselves, 'coach' when the
-- coach reached the parent afterwards and recorded it on the admin page.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_confirm_source TEXT NOT NULL DEFAULT '';

-- Things the coach types on the admin page and the site reads back: today only
-- the payment details for the invitation email. Kept here and not in a file
-- because every file in this project is served publicly.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Instagram and TikTok names, added September 2026 at the coach's request:
-- scouts look players up, and he wants the handle without hunting for it.
-- Optional, and stored as the bare handle with no @ and no URL.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS instagram TEXT NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS tiktok TEXT NOT NULL DEFAULT '';

-- The invitation email, added September 2026. invited_at is the last time one
-- was actually sent, invite_count how many times (a resend is normal: people
-- lose emails), invite_to the address it went to, so the coach can see where.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS invite_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS invite_to TEXT NOT NULL DEFAULT '';

-- A one-player link that lets a parent give the permission themselves, instead
-- of the coach phoning them. Cleared the moment it is used, so a link that has
-- already given permission stops working.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_token TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_token_expires_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS applicants_parent_token_idx
  ON applicants (parent_token) WHERE parent_token IS NOT NULL;

-- Who typed the permission, and what they answered. 'parent' is a permission;
-- 'player' is a parent telling us the child filled the form alone, which is
-- not permission — it is a flag for the coach to call them.
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_confirm_name TEXT NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_reply TEXT NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS parent_reply_at TIMESTAMPTZ;

-- Private links the coach gives to a scout or club. A link lists applicant
-- ids, but what it shows is decided when it is opened: anyone archived or
-- whose permission was withdrawn since then simply no longer appears.
CREATE TABLE IF NOT EXISTS shares (
  id             BIGSERIAL PRIMARY KEY,
  token          TEXT NOT NULL UNIQUE,
  recipient      TEXT NOT NULL,
  applicant_ids  BIGINT[] NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ,
  views          INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

-- Wrong password tries on the coach's page, counted per address so guessing
-- can be slowed down. Rows are removed as soon as the right password arrives.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip           TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS applicants_event_idx   ON applicants (event, status);
CREATE INDEX IF NOT EXISTS applicants_created_idx ON applicants (created_at DESC);

-- One application per email per event. Archived rows are excluded, so someone
-- who was removed can apply again.
CREATE UNIQUE INDEX IF NOT EXISTS applicants_event_email_active_idx
  ON applicants (event, lower(email)) WHERE deleted_at IS NULL;
`;
