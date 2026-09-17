/* The one file to edit for registration.

   Shared by the sign-up page (in the browser) and the API (on the server), so
   the list of events and positions can never disagree between the two.

   To open a new event: add it to EVENTS with open: true. To close one, set
   open: false — its applicants stay on the admin page, but nobody new can
   apply to it. Never change an event's id once people have applied. */

export const EVENTS = [
  {
    id: 'final-oct-2026',
    label: { es: 'Evento Final — Octubre 2026', en: 'Final Event — October 2026' },
    open: true,
  },
];

export const POSITIONS = [
  { id: 'GK',  es: 'Portero (GK)',                    en: 'Goalkeeper (GK)' },
  { id: 'CB',  es: 'Defensa central (CB)',            en: 'Center back (CB)' },
  { id: 'RB',  es: 'Lateral derecho (RB)',            en: 'Right back (RB)' },
  { id: 'LB',  es: 'Lateral izquierdo (LB)',          en: 'Left back (LB)' },
  { id: 'CDM', es: 'Medio defensivo (CDM)',           en: 'Defensive midfielder (CDM)' },
  { id: 'CM',  es: 'Medio centro (CM)',               en: 'Central midfielder (CM)' },
  { id: 'CAM', es: 'Medio ofensivo (CAM)',            en: 'Attacking midfielder (CAM)' },
  { id: 'RW',  es: 'Extremo derecho (RW)',            en: 'Right winger (RW)' },
  { id: 'LW',  es: 'Extremo izquierdo (LW)',          en: 'Left winger (LW)' },
  { id: 'ST',  es: 'Delantero (ST)',                  en: 'Striker (ST)' },
];

export const STRONG_LEG = ['right', 'left', 'both'];

/* Bump this whenever the waiver text in registro.html changes, so every
   applicant's record shows which version they agreed to. */
export const WAIVER_VERSION = '2026-09';

/* Same for the permission to share a player's profile with clubs and scouts
   (the rg_consent_text key in js/i18n.js, in both languages). */
export const CONSENT_VERSION = '2026-09';

/* How long a link the coach shares with a scout can stay open, in days. */
export const SHARE_LINK_DAYS = [7, 30, 90];

export const MINOR_AGE = 18;
