/* The parent's permission page.

   Its own little dictionary, like scout.js: the page is opened by a parent who
   may never have seen the site, and the wording here matters more than sharing
   keys with the rest of it. */

const $ = (id) => document.getElementById(id);

const DICT = {
  es: {
    loading: 'Cargando…',
    gone_h: 'LINK NO DISPONIBLE',
    gone_p: 'Este link venció o ya se usó. Escríbenos por WhatsApp y te mandamos uno nuevo.',
    wa: 'Escribir por WhatsApp',
    tag: 'Permiso del papá, mamá o tutor',
    h: 'PERMISO DEL TUTOR',
    p: 'Este jugador es menor de 13 años. Por eso necesitamos que un papá, mamá o tutor nos diga que está de acuerdo con su registro en BE PRO Futbol.',
    who: '¿Quién llenó el registro?',
    who_parent: 'Yo, el papá, la mamá o el tutor',
    who_player: 'Mi hijo o hija lo llenó por su cuenta',
    name: 'Su nombre completo *',
    email: 'Su correo (opcional)',
    email_help: 'Solo lo usamos para avisarle cosas del evento.',
    agree: 'Doy permiso para que este jugador participe en los eventos de BE PRO Futbol y para que BE PRO Futbol guarde su información como lo explica el aviso de privacidad.',
    send: 'ENVIAR',
    privacy: 'Aviso de privacidad',
    terms: 'Términos de uso',
    done_h: 'PERMISO RECIBIDO',
    done_p: 'Gracias. Ya quedó registrado. Si tiene cualquier duda, escríbanos por WhatsApp.',
    done_h_player: 'GRACIAS POR DECIRNOS',
    done_p_player: 'Lo anotamos. Le vamos a marcar para darle los detalles y pedirle el permiso directamente.',
    err_name: 'Escriba su nombre completo.',
    err_agree: 'Marque la casilla del permiso.',
    err_email: 'Ese correo no se ve bien. Puede dejarlo vacío.',
    err_send: 'No se pudo enviar. Revise su internet e inténtelo otra vez.',
    years: 'años',
  },
  en: {
    loading: 'Loading…',
    gone_h: 'LINK NOT AVAILABLE',
    gone_p: 'This link expired or was already used. Message us on WhatsApp and we will send a new one.',
    wa: 'Message us on WhatsApp',
    tag: "Parent or guardian's permission",
    h: "PARENT'S PERMISSION",
    p: 'This player is under 13. We need a parent or legal guardian to tell us they agree with their registration with BE PRO Futbol.',
    who: 'Who filled in the registration?',
    who_parent: 'I did — the parent or legal guardian',
    who_player: 'My son or daughter filled it in on their own',
    name: 'Your full name *',
    email: 'Your email (optional)',
    email_help: 'We only use it to tell you about the event.',
    agree: 'I give permission for this player to take part in BE PRO Futbol events and for BE PRO Futbol to keep their information as explained in the privacy notice.',
    send: 'SEND',
    privacy: 'Privacy notice',
    terms: 'Terms of use',
    done_h: 'PERMISSION RECEIVED',
    done_p: 'Thank you. It is on record. If you have any questions, message us on WhatsApp.',
    done_h_player: 'THANK YOU FOR TELLING US',
    done_p_player: 'We noted it. We will call you to go through the details and ask for the permission directly.',
    err_name: 'Please type your full name.',
    err_agree: 'Please tick the permission box.',
    err_email: 'That email does not look right. You can leave it empty.',
    err_send: 'Could not send. Check your connection and try again.',
    years: 'years old',
  },
};

let lang = 'es';
const t = (k) => (DICT[lang] && DICT[lang][k]) || DICT.es[k] || '';
const token = new URLSearchParams(location.search).get('t') || '';

function paint() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const b of document.querySelectorAll('[data-pm-lang]')) {
    b.classList.toggle('active', b.dataset.pmLang === lang);
  }
}

function show(id) {
  for (const s of ['pmLoading', 'pmUnavailable', 'pmForm', 'pmDone']) $(s).hidden = s !== id;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pm-lang]');
  if (!b) return;
  lang = b.dataset.pmLang;
  paint();
});

/* Which fields are asked for depends on the answer: a parent saying "my kid
   filled it in" is not giving permission, so we do not ask them to sign one. */
function updateWho() {
  const who = document.querySelector('input[name="who"]:checked').value;
  $('pmParentFields').hidden = who !== 'parent';
}
for (const r of document.querySelectorAll('input[name="who"]')) {
  r.addEventListener('change', updateWho);
}

function fail(key) {
  $('pmError').textContent = t(key);
  $('pmError').hidden = false;
}

$('pmFormEl').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('pmError').hidden = true;

  const who = document.querySelector('input[name="who"]:checked').value;
  const name = $('pmParentName').value.trim();
  const email = $('pmParentEmail').value.trim();

  if (who === 'parent') {
    if (!name) return fail('err_name');
    if (!$('pmAgree').checked) return fail('err_agree');
  }

  const btn = $('pmSubmit');
  btn.disabled = true;
  let res, data = {};
  try {
    res = await fetch('/api/permiso', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ t: token, who, name, email }),
    });
    data = await res.json().catch(() => ({}));
  } catch { /* offline */ }
  btn.disabled = false;

  if (!res) return fail('err_send');
  if (res.status === 404) return show('pmUnavailable');
  if (!res.ok) return fail(data.error === 'email' ? 'err_email' : 'err_send');

  $('pmDoneH').textContent = t(who === 'player' ? 'done_h_player' : 'done_h');
  $('pmDoneP').textContent = t(who === 'player' ? 'done_p_player' : 'done_p');
  $('pmDoneH').removeAttribute('data-t');
  $('pmDoneP').removeAttribute('data-t');
  show('pmDone');
});

(async function start() {
  paint();
  if (!token) return show('pmUnavailable');

  let data;
  try {
    const res = await fetch('/api/permiso?t=' + encodeURIComponent(token));
    if (!res.ok) return show('pmUnavailable');
    data = await res.json();
  } catch {
    return show('pmUnavailable');
  }

  lang = data.lang === 'en' ? 'en' : 'es';
  paint();
  $('pmName').textContent = data.name;
  $('pmAge').textContent = data.age ? data.age + ' ' + t('years') : '';
  $('pmEvent').textContent = data.event || '';
  updateWho();
  show('pmForm');
})();
