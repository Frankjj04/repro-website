/* The database schema, as a static import so the serverless bundler always
   ships it. Every statement is IF NOT EXISTS, so applying it repeatedly is
   free — lib/db.js runs it once per warm instance. */

export const SCHEMA = `
-- Be Pro Soccer — scouting event applications

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

CREATE INDEX IF NOT EXISTS applicants_event_idx   ON applicants (event, status);
CREATE INDEX IF NOT EXISTS applicants_created_idx ON applicants (created_at DESC);

-- One application per email per event. Archived rows are excluded, so someone
-- who was removed can apply again.
CREATE UNIQUE INDEX IF NOT EXISTS applicants_event_email_active_idx
  ON applicants (event, lower(email)) WHERE deleted_at IS NULL;
`;
