/* The one file to edit for registration.

   Shared by the sign-up page (in the browser) and the API (on the server), so
   the list of events and positions can never disagree between the two.

   To open a new event: add it to EVENTS with open: true. To close one, set
   open: false — its applicants stay on the admin page, but nobody new can
   apply to it. Never change an event's id once people have applied. */

/* November Scouting Madness 2026 — the coach's three events.

   `years` is the birth years each date is aimed at, shown on the card.
   `rule` is what is actually enforced:
     'any'       — anyone may sign up, older or younger (the coach wants the
                   first date open to everybody).
     'no_older'  — a younger player may play up, but nobody born before
                   years[0] gets in; they are pointed at the open date. */
export const EVENTS = [
  {
    id: 'nov-10-11',
    dates: { es: '10 y 11 de noviembre', en: 'November 10 & 11' },
    leagues: ['Liga de Expansión', '2da Premier', 'USL'],
    years: [2003, 2008],
    rule: 'any',
    label: { es: '10 y 11 nov — Liga de Expansión, 2da Premier, USL (2003-2008)',
             en: 'Nov 10 & 11 — Liga de Expansión, 2da Premier, USL (2003-2008)' },
    open: true,
  },
  {
    id: 'nov-17-18',
    dates: { es: '17 y 18 de noviembre', en: 'November 17 & 18' },
    leagues: ['Liga MX'],
    years: [2008, 2011],
    rule: 'no_older',
    label: { es: '17 y 18 nov — Liga MX (2008-2011)',
             en: 'Nov 17 & 18 — Liga MX (2008-2011)' },
    open: true,
  },
  {
    id: 'nov-24-25',
    dates: { es: '24 y 25 de noviembre', en: 'November 24 & 25' },
    leagues: ['MLS'],
    years: [2012, 2014],
    rule: 'no_older',
    label: { es: '24 y 25 nov — MLS (2012-2014)',
             en: 'Nov 24 & 25 — MLS (2012-2014)' },
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
export const WAIVER_VERSION = '2026-09-17';

/* Same for the permission to share a player's profile with clubs and scouts
   (the rg_consent_text key in js/i18n.js, in both languages). */
export const CONSENT_VERSION = '2026-09';

/* How long a link the coach shares with a scout can stay open, in days. */
export const SHARE_LINK_DAYS = [7, 30, 90];

export const MINOR_AGE = 18;
