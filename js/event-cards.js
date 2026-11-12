/* The event cards on the home and events pages, kept in step with the
   sign-up form: the day after an event ends (js/registro-config.js, `end`)
   its card says Terminado instead of offering a Register button that would
   lead to a closed form. */
import { EVENTS, isPast } from './registro-config.js';

document.querySelectorAll('[data-event]').forEach((card) => {
  const e = EVENTS.find((x) => x.id === card.dataset.event);
  if (!e || !isPast(e)) return;
  card.classList.add('is-past');
  const btn = card.querySelector('a.btn');
  if (!btn) return;
  const done = document.createElement('span');
  done.className = 'btn btn-outline btn-sm ev-done';
  done.setAttribute('data-i18n', 'nov_done');
  // i18n.js re-labels it on a language change; this is the first label.
  const lang = (typeof I18N !== 'undefined' && I18N.current) || 'es';
  done.textContent = lang === 'en' ? 'Finished' : 'Terminado';
  if (btn.style.marginTop) done.style.marginTop = btn.style.marginTop;
  btn.replaceWith(done);
});
