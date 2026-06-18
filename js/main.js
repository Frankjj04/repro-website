/* =========================================
   BE PRO SOCCER — Main JavaScript
   ========================================= */

'use strict';

/* ===================== PARTICLE CANVAS ===================== */
class BeProParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.running = true;
    this.maxDist = 130;
    this.resize();
    this.spawnParticles();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    this.loop();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.count = window.innerWidth < 600 ? 35 : window.innerWidth < 1024 ? 55 : 85;
  }

  spawnParticles() {
    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      this.particles.push({
        x:       Math.random() * this.canvas.width,
        y:       Math.random() * this.canvas.height,
        vx:      (Math.random() - 0.5) * 0.38,
        vy:      (Math.random() - 0.5) * 0.38,
        r:       Math.random() * 1.8 + 0.4,
        opacity: Math.random() * 0.45 + 0.1,
        orange:  Math.random() > 0.68,
      });
    }
  }

  tick() {
    const W = this.canvas.width, H = this.canvas.height;
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0)  p.x = W;
      if (p.x > W)  p.x = 0;
      if (p.y < 0)  p.y = H;
      if (p.y > H)  p.y = 0;
    });
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    /* connection lines */
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i], b = this.particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < this.maxDist) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0,212,255,${0.12 * (1 - d / this.maxDist)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    /* dots */
    this.particles.forEach(p => {
      const rgb = p.orange ? '255,107,26' : '0,212,255';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${p.opacity})`;
      ctx.fill();
    });
  }

  loop() {
    this.tick();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

/* ===================== MOBILE NAVIGATION ===================== */
function initNav() {
  const ham    = document.querySelector('.hamburger');
  const mNav   = document.querySelector('.mobile-nav');
  if (!ham || !mNav) return;

  ham.addEventListener('click', () => {
    const open = ham.classList.toggle('active');
    mNav.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  mNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      ham.classList.remove('active');
      mNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('click', e => {
    if (!ham.contains(e.target) && !mNav.contains(e.target)) {
      ham.classList.remove('active');
      mNav.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

/* ===================== NAVBAR SCROLL ===================== */
function initNavbarScroll() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);
    last = y;
  }, { passive: true });
}

/* ===================== ACTIVE NAV LINK ===================== */
function setActiveLink() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const match = href === file ||
      (file === '' && href === 'index.html') ||
      (file === 'index.html' && (href === './' || href === 'index.html'));
    a.classList.toggle('active', match);
  });
}

/* ===================== SCROLL REVEAL ===================== */
function initReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (!els.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => obs.observe(el));
}

/* ===================== COUNTER ANIMATION ===================== */
function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el      = e.target;
      const target  = parseInt(el.dataset.count, 10);
      const suffix  = el.dataset.suffix || '';
      const dur     = 1600;
      const t0      = performance.now();

      function step(now) {
        const p   = Math.min((now - t0) / dur, 1);
        const eas = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(eas * target).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString() + suffix;
      }

      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });

  els.forEach(el => obs.observe(el));
}

/* ===================== SMOOTH SCROLL ===================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ===================== CONTACT FORM ===================== */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn  = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.textContent = 'SENDING...';
    btn.disabled    = true;

    setTimeout(() => {
      btn.textContent       = 'MESSAGE SENT ✓';
      btn.style.background  = '#22c55e';
      btn.style.borderColor = '#22c55e';
      setTimeout(() => {
        btn.textContent       = orig;
        btn.style.background  = '';
        btn.style.borderColor = '';
        btn.disabled          = false;
        form.reset();
      }, 3000);
    }, 1400);
  });
}

/* ===================== ADD TO CART (UI) ===================== */
function initCart() {
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const orig        = btn.textContent;
      btn.textContent   = 'ADDED ✓';
      btn.style.background  = '#22c55e';
      btn.style.borderColor = '#22c55e';
      btn.style.color       = '#fff';
      btn.disabled          = true;
      setTimeout(() => {
        btn.textContent       = orig;
        btn.style.background  = '';
        btn.style.borderColor = '';
        btn.style.color       = '';
        btn.disabled          = false;
      }, 2200);
    });
  });
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  /* Particles only on hero page */
  if (document.getElementById('heroCanvas')) {
    new BeProParticles('heroCanvas');
  }

  initNav();
  initNavbarScroll();
  setActiveLink();
  initReveal();
  initCounters();
  initSmoothScroll();
  initContactForm();
  initCart();
});
