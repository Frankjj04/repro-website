/* BE PRO — "Apple Design" lab: motion and touch feedback (experiment, 2026-11-19).

   Purely presentational. It never changes text, data, links or what any
   button does — it only adds classes and CSS variables:

   · Response: anything tappable gets .is-pressed on pointer-DOWN, so it
     reacts before the finger lifts (apple-design §1, §10).
   · Stagger: cards inside a section arrive one after another instead of as
     one block, on the same critically-damped curve (§4, restraint: no bounce).
   · Everything is a CSS transition, so a half-finished entrance simply
     continues from where it is (§3, interruptibility).
   · Reduced motion: no stagger, no movement — css/apple.css cross-fades. */
(() => {
  'use strict';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- press feedback ---------- */
  const PRESSABLE = '.btn, .rg-event-card:not(.rg-event-off), .rg-choice, .ad-evcard, .ad-quick button, ' +
    '.ad-views button, .ad-tabs button, .ad-year, .ad-wa-to button, .lang-btn, .cal-open .btn, .social-pill, .hamburger';
  let pressed = null;
  const release = () => { if (pressed) { pressed.classList.remove('is-pressed'); pressed = null; } };
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest(PRESSABLE);
    if (!el || el.disabled) return;
    release();
    pressed = el;
    el.classList.add('is-pressed');
  }, { passive: true });
  ['pointerup', 'pointercancel', 'dragstart'].forEach((t) => document.addEventListener(t, release, { passive: true }));
  // Dragging the finger away cancels the press, like a native button.
  document.addEventListener('pointermove', (e) => {
    if (!pressed) return;
    const r = pressed.getBoundingClientRect();
    const pad = 12;   // hysteresis around the target
    if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) release();
  }, { passive: true });

  if (reduce) return;

  /* ---------- staggered entrances ---------- */
  const GROUPS = '.upcoming-grid, .ev26-grid, .needs-grid, .impact-grid, .photo-grid, .cal-list, .ev26-steps, ' +
    '.bento, .ev-photos, .team-grid, .tiers-grid, .steps-grid, .pillars-grid, .gallery-grid, .eco-grid, .features-grid, .ss-list';
  const STEP = 35, MAX = 175;

  function stagger(group) {
    [...group.children].forEach((child, i) => {
      if (child.classList.contains('cal-head')) return;
      child.classList.add('fl-item');
      child.style.setProperty('--i', String(Math.min(i * STEP, MAX)) + 'ms');
    });
  }
  // Sibling .reveal blocks inside one section also arrive in order.
  document.querySelectorAll('section, .stats-bar').forEach((sec) => {
    sec.querySelectorAll(':scope .reveal, :scope .reveal-left, :scope .reveal-right').forEach((el, i) => {
      el.style.setProperty('--stagger', Math.min(i * 50, 150) + 'ms');
    });
  });

  const groups = document.querySelectorAll(GROUPS);
  groups.forEach((g) => {
    stagger(g);
    // Event cards are drawn by js/event-cards.js (and again on a language
    // change): pick up whatever it puts in.
    new MutationObserver(() => stagger(g)).observe(g, { childList: true });
    // A group that is not inside a .reveal block gets its own trigger.
    if (!g.closest('.reveal, .reveal-left, .reveal-right')) {
      g.classList.add('fl-group');
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((en) => { if (en.isIntersecting) { g.classList.add('in-view'); io.disconnect(); } });
        }, { rootMargin: '0px 0px -8% 0px' });
        io.observe(g);
      } else {
        g.classList.add('in-view');
      }
    }
  });

  /* ---------- hero settles back as the page scrolls ----------
     Read on scroll, written once per frame; only transform + opacity, which
     the compositor animates without layout. */
  const hero = document.querySelector('.hero');
  const heroContent = hero && hero.querySelector('.hero-content');
  if (heroContent) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const h = hero.offsetHeight || 1;
      const t = Math.min(Math.max(window.scrollY / (h * 0.75), 0), 1);
      heroContent.style.setProperty('--hero-y', (t * 60).toFixed(1) + 'px');
      heroContent.style.setProperty('--hero-s', (1 - t * 0.06).toFixed(4));
      heroContent.style.setProperty('--hero-o', (1 - t * 0.9).toFixed(3));
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- the stats shelf rises into place under the hero ---------- */
  const shelf = document.querySelector('.stats-bar');
  if (shelf && 'IntersectionObserver' in window) {
    shelf.classList.add('fl-shelf');
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { shelf.classList.add('in-view'); io.disconnect(); } });
    io.observe(shelf);
  }
})();
