/* The one file to edit for registration.

   Shared by the sign-up page (in the browser) and the API (on the server), so
   the list of events and positions can never disagree between the two.

   To open a new event: add it to EVENTS with open: true and its last day as
   `end`. The day after `end` (Las Vegas time) it closes by itself on the
   sign-up page and moves to Historial on the admin page — its players are
   never deleted. To close one early, set open: false. Never change an
   event's id once people have applied. */

/* `years` is the first and last birth year a date takes, both included —
   the form refuses anybody outside them (coach, 2026-11-19: "bloquear").
   Every field a page shows lives here, so the sign-up form, the home and
   events pages and the admin page always say the same thing. */

/* The coach's 2027 calendar (sent 2026-11-16, ages 2026-11-16 11:29 PM).
   Ages are counted the soccer way, by birth year: 16–20 in 2027 means born
   2007–2011. Built with ev() so the birth years can never disagree with the
   ages shown. Only January–April take sign-ups for now (coach: "Necesito los
   eventos hasta el de Abril"); the rest show as Próximamente. */
const MES = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_ES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ev(id, start, end, name, ages, divisions, open) {
  const [y, m, d1] = start.split('-').map(Number);
  const d2 = Number(end.slice(8, 10));
  const years = [y - ages[1], y - ages[0]];
  const en = typeof name === 'string' ? name : name.en;
  const es = typeof name === 'string' ? name : name.es;
  return {
    id, start, end, open, ages, years,
    name: { es, en },
    divisions,
    dates: { es: d1 + ' y ' + d2 + ' de ' + MONTH_ES[m], en: MONTH_EN[m] + ' ' + d1 + ' & ' + d2 },
    short: { es: d1 + '–' + d2 + ' ' + MES[m].toUpperCase(), en: MON_EN[m].toUpperCase() + ' ' + d1 + '–' + d2 },
    leagues: divisions.split(' / '),
    label: {
      es: d1 + ' y ' + d2 + ' ' + MES[m] + ' — ' + es + ' (' + ages[0] + '-' + ages[1] + ' años)',
      en: MON_EN[m] + ' ' + d1 + ' & ' + d2 + ' — ' + en + ' (ages ' + ages[0] + '-' + ages[1] + ')',
    },
  };
}

export const EVENTS = [
  /* November Scouting Madness 2026 — the coach's three events. 2008 and 2011
     each fit two dates; the player picks. */
  {
    id: 'nov-10-11',
    start: '2026-11-10',
    end: '2026-11-11',
    name: { es: 'Expansión · 2da Premier · USL', en: 'Expansión · 2da Premier · USL' },
    dates: { es: '10 y 11 de noviembre', en: 'November 10 & 11' },
    short: { es: '10–11 NOV', en: 'NOV 10–11' },
    leagues: ['Liga de Expansión', '2da Premier', 'USL'],
    years: [2003, 2008],
    label: { es: '10 y 11 nov — Liga de Expansión, 2da Premier, USL (2003-2008)',
             en: 'Nov 10 & 11 — Liga de Expansión, 2da Premier, USL (2003-2008)' },
    open: true,
  },
  {
    id: 'nov-17-18',
    start: '2026-11-17',
    end: '2026-11-18',
    name: { es: 'Liga MX', en: 'Liga MX' },
    dates: { es: '17 y 18 de noviembre', en: 'November 17 & 18' },
    short: { es: '17–18 NOV', en: 'NOV 17–18' },
    leagues: ['Liga MX'],
    years: [2008, 2011],
    label: { es: '17 y 18 nov — Liga MX (2008-2011)',
             en: 'Nov 17 & 18 — Liga MX (2008-2011)' },
    open: true,
  },
  {
    id: 'nov-24-25',
    start: '2026-11-24',
    end: '2026-11-25',
    name: { es: 'MLS', en: 'MLS' },
    dates: { es: '24 y 25 de noviembre', en: 'November 24 & 25' },
    short: { es: '24–25 NOV', en: 'NOV 24–25' },
    leagues: ['MLS'],
    years: [2011, 2014],
    label: { es: '24 y 25 nov — MLS (2011-2014)',
             en: 'Nov 24 & 25 — MLS (2011-2014)' },
    open: true,
  },

  /* Coach, 2026-11-26: "Liga MX Femenil", 9 y 10 de diciembre, Ed Fountain
     Park, born 2005–2008 (18–21 counted in 2026). Girls only: the coach picks
     who is invited, so the form needs no new question. */
  ev('2026-12-femenil', '2026-12-09', '2026-12-10', 'Liga MX Femenil', [18, 21], 'Liga MX Femenil', true),

  // 2027 — open for sign-ups
  ev('2027-01-colegio',   '2027-01-19', '2027-01-20', { es: 'Colegio USA', en: 'College USA' }, [16, 20], 'High School / NCAA', true),
  ev('2027-02-usl',       '2027-02-16', '2027-02-17', 'USL', [17, 21], 'USL Championship / Academy', true),
  ev('2027-03-ligamx',    '2027-03-09', '2027-03-10', 'Liga MX', [17, 21], 'Sub-17 a Sub-21', true),
  ev('2027-03-expansion', '2027-03-23', '2027-03-24', 'Expansión + 2ª Premier', [17, 21], 'Expansión MX / 2ª Premier', true),
  ev('2027-04-europa',    '2027-04-13', '2027-04-14', { es: 'Europa', en: 'Europe' }, [18, 23], 'Ligas Europeas', true),
  // 2027 — on the calendar, sign-ups not open yet
  ev('2027-05-femenil',   '2027-05-18', '2027-05-19', 'Liga MX Femenil', [16, 22], 'Liga MX Femenil', false),
  ev('2027-06-premier',   '2027-06-15', '2027-06-16', '2ª Premier + TDP', [17, 21], '2ª Premier / TDP', false),
  ev('2027-10-ligamx',    '2027-10-12', '2027-10-13', 'Liga MX', [17, 21], 'Sub-17 a Sub-21', false),
  ev('2027-10-expansion', '2027-10-26', '2027-10-27', 'Expansión + 2ª Premier', [17, 21], 'Expansión MX / 2ª Premier', false),
  ev('2027-11-mls',       '2027-11-16', '2027-11-17', 'MLS', [18, 24], 'MLS / MLS NEXT Pro', false),
];

/* Today in Las Vegas, as YYYY-MM-DD — the coach's calendar, not the server's. */
export function vegasToday(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}
/* An event is over the day after its last day. */
export const isPast = (e, now) => Boolean(e && e.end && vegasToday(now) > e.end);
/* Taking sign-ups: open, and not over yet. */
export const isOpen = (e, now) => Boolean(e && e.open && !isPast(e, now));

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

/* The player profile the coach asked for on 2026-11-19 ("El formulario así
   por fa. De todos los eventos ya"). Ids are stored; labels are shown. */
export const LEVELS = [
  { id: 'recreativo',  es: 'Recreativo',                 en: 'Recreational' },
  { id: 'academia',    es: 'Academia competitiva',       en: 'Competitive academy' },
  { id: 'high_school', es: 'High School',                en: 'High School' },
  { id: 'mls_next',    es: 'MLS NEXT',                   en: 'MLS NEXT' },
  { id: 'ecnl',        es: 'ECNL',                       en: 'ECNL' },
  { id: 'upsl',        es: 'UPSL / Semiprofesional',     en: 'UPSL / Semi-pro' },
  { id: 'pro',         es: 'Profesional',                en: 'Professional' },
  { id: 'otro',        es: 'Otro',                       en: 'Other' },
];
export const AVAILABLE = [
  { id: 'now',   es: 'De inmediato',                  en: 'Right away' },
  { id: '3m',    es: 'En 1 a 3 meses',                en: 'In 1 to 3 months' },
  { id: '6m',    es: 'En 3 a 6 meses',                en: 'In 3 to 6 months' },
  { id: 'later', es: 'En más de 6 meses',             en: 'In more than 6 months' },
];
export const INTEREST = [
  { id: 'pro',     es: 'Fútbol profesional',  en: 'Professional soccer' },
  { id: 'college', es: 'Fútbol universitario', en: 'College soccer' },
  { id: 'both',    es: 'Ambos',               en: 'Both' },
];

/* Bump this whenever the waiver text in registro.html changes, so every
   applicant's record shows which version they agreed to. */
export const WAIVER_VERSION = '2026-09-17.2';

/* Same for the permission to share a player's profile with clubs and scouts
   (the rg_consent_text key in js/i18n.js, in both languages). */
export const CONSENT_VERSION = '2026-11-19';

/* How long a link the coach shares with a scout can stay open, in days. */
export const SHARE_LINK_DAYS = [7, 30, 90];

export const MINOR_AGE = 18;

/* Under this age a parent or guardian must be the one filling the form: we ask
   for their email and an explicit statement that it is them. US rules on
   children's data (COPPA) expect a parent, not the child, to hand over the
   information. */
export const CHILD_AGE = 13;
