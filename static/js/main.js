/* main.js — Mustafa Noman Portfolio */

(function () {
  'use strict';

  /* ── Utilities ───────────────────────────────────────────── */
  const throttle = (fn, ms) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn(...args); }
    };
  };

  /* ── Page Loader ─────────────────────────────────────────── */
  const initLoader = () => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    const hide = () => {
      loader.classList.add('hidden');
      setTimeout(() => {
        loader.remove();
        initHeroEntrance();
      }, 520);
    };
    if (document.readyState === 'complete') {
      setTimeout(hide, 800);
    } else {
      let fallback = setTimeout(hide, 2200);
      window.addEventListener('load', () => { clearTimeout(fallback); setTimeout(hide, 800); }, { once: true });
    }
  };

  /* ── GSAP Hero Entrance ──────────────────────────────────── */
  const initHeroEntrance = () => {
    if (typeof gsap === 'undefined') return;
    if (!document.querySelector('.hero')) return;

    gsap.set('.hero__left',         { y: 70, opacity: 0 });
    gsap.set('.hero__right',        { x: 60, opacity: 0 });
    gsap.set('.hero__avail',        { y: -24, opacity: 0 });
    gsap.set('.hero__float--left',  { x: -30, y: 16, opacity: 0 });
    gsap.set('.hero__float--right', { x: 30, y: -16, opacity: 0 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to('.hero__left',         { y: 0, opacity: 1, duration: 1.0 })
      .to('.hero__right',        { x: 0, opacity: 1, duration: 1.0 }, '-=0.75')
      .to('.hero__avail',        { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)' }, '-=0.5')
      .to('.hero__float--left',  { x: 0, y: 0, opacity: 1, duration: 0.65, ease: 'back.out(1.8)' }, '-=0.45')
      .to('.hero__float--right', { x: 0, y: 0, opacity: 1, duration: 0.65, ease: 'back.out(1.8)' }, '-=0.55');
  };

  /* ── Scroll Progress ─────────────────────────────────────── */
  const initScrollProgress = () => {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.prepend(bar);

    const update = throttle(() => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = pct + '%';
    }, 16);

    window.addEventListener('scroll', update, { passive: true });
  };

  /* ── Nav Scroll Behavior ─────────────────────────────────── */
  const initNav = () => {
    const nav = document.getElementById('nav');
    if (!nav) return;

    let lastY = 0;
    nav.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1), background 0.4s';

    const onScroll = throttle(() => {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 40);
      if (y > 300) {
        nav.style.transform = y > lastY ? 'translateY(-100%)' : 'translateY(0)';
      } else {
        nav.style.transform = 'translateY(0)';
      }
      lastY = y;
    }, 80);

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  /* ── Mobile Burger ───────────────────────────────────────── */
  const initBurger = () => {
    const burger = document.getElementById('navBurger');
    const links  = document.getElementById('navLinks');
    if (!burger || !links) return;

    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.classList.toggle('active', open);
      burger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        burger.classList.remove('active');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        burger.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  };

  /* ── Scroll Reveal ───────────────────────────────────────── */
  const initReveal = () => {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    const parents = new Map();
    els.forEach(el => {
      const p = el.parentElement;
      if (!parents.has(p)) parents.set(p, 0);
      const idx = parents.get(p);
      el.dataset.delay = idx * 80;
      parents.set(p, idx + 1);
    });

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = parseInt(entry.target.dataset.delay) || 0;
        setTimeout(() => entry.target.classList.add('visible'), delay);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    els.forEach(el => obs.observe(el));
  };

  /* ── Number Counters ─────────────────────────────────────── */
  const initCounters = () => {
    const els = document.querySelectorAll('.stat__num, .hero__float-val, .stat-card__num');
    if (!els.length) return;

    const ease = t => 1 - Math.pow(1 - t, 3);

    const animate = (el) => {
      const raw = el.textContent;
      const m = raw.match(/([\$]?)([\d,.]+)([KM%+]*)/);
      if (!m) return;
      const prefix = m[1] || '';
      const target = parseFloat(m[2].replace(/,/g, ''));
      const suffix = m[3] || '';
      const dur = 1600;
      const start = performance.now();

      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const val = target * ease(p);
        let disp;
        if (target >= 1000) disp = Math.floor(val).toLocaleString('en-US');
        else if (target % 1 !== 0) disp = val.toFixed(1);
        else disp = Math.floor(val);
        el.textContent = prefix + disp + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); }
      });
    }, { threshold: 0.5 });

    els.forEach(el => obs.observe(el));
  };

  /* ── Parallax / Mouse Movement ───────────────────────────── */
  const initParallax = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const frame = document.querySelector('.hero__frame');
    if (!frame) return;

    const move = throttle((e) => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      const rx = (e.clientX - cx) / cx;
      const ry = (e.clientY - cy) / cy;
      frame.style.transform = `translate(${rx * -6}px, ${ry * -6}px)`;
    }, 16);

    document.addEventListener('mousemove', move);
  };

  /* ── Skills Strip Pause ──────────────────────────────────── */
  const initSkillsStrip = () => {
    const track = document.querySelector('.skills-strip__track');
    if (!track) return;
    const wrap = track.closest('.skills-strip');
    if (wrap) {
      wrap.addEventListener('mouseenter', () => track.style.animationPlayState = 'paused');
      wrap.addEventListener('mouseleave', () => track.style.animationPlayState = 'running');
    }
  };

  /* ── Flash Messages ──────────────────────────────────────── */
  const dismissFlash = (flash) => {
    flash.style.opacity = '0';
    flash.style.transform = 'translateX(110%)';
    flash.style.transition = 'all 0.4s ease';
    setTimeout(() => flash.remove(), 420);
  };

  const initFlash = () => {
    document.querySelectorAll('.flash').forEach(flash => {
      const isError = flash.classList.contains('flash--danger') || flash.classList.contains('flash--warning');

      // Errors and warnings persist until manually closed
      if (!isError) {
        setTimeout(() => dismissFlash(flash), 5000);
      }

      const btn = flash.querySelector('.flash__close');
      if (btn) {
        btn.addEventListener('click', () => dismissFlash(flash));
      }
    });
  };

  /* ── Form Focus Effects ──────────────────────────────────── */
  const initForms = () => {
    document.querySelectorAll('.form-control').forEach(input => {
      const g = input.closest('.form-group');
      if (!g) return;

      const updateHasValue = () => {
        const filled = input.value.trim().length > 0;
        input.classList.toggle('has-value', filled);
      };

      input.addEventListener('focus',  () => g.classList.add('focused'));
      input.addEventListener('blur',   () => g.classList.remove('focused'));
      input.addEventListener('input',  updateHasValue);
      input.addEventListener('change', updateHasValue);
      updateHasValue();
    });
  };

  /* ── Smooth Scroll ───────────────────────────────────────── */
  const initSmoothScroll = () => {
    const nav = document.getElementById('nav');
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', function(e) {
        const id = this.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const offset = (nav ? nav.offsetHeight : 0) + 20;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  };

  /* ── ScrollTrigger Parallax ──────────────────────────────── */
  const initScrollParallax = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    [
      ['.hero__glow--1', { y: -120 },       1.5],
      ['.hero__glow--2', { y: -80, x: 40 }, 2  ],
      ['.hero__glow--3', { y: -60 },        1  ],
    ].forEach(([sel, props, scrub]) => {
      const el = document.querySelector(sel);
      if (el) gsap.to(el, { ...props, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub } });
    });

  };

  /* ── Scroll-to-Top Button ───────────────────────────────────── */
  const initScrollTop = () => {
    const btn = document.getElementById('scrollTop');
    if (!btn) return;

    const toggle = throttle(() => {
      btn.classList.toggle('visible', window.scrollY > 500);
    }, 100);

    window.addEventListener('scroll', toggle, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  /* ── Reading Time Estimate ───────────────────────────────────── */
  const initReadingTime = () => {
    const content = document.querySelector('.post-content');
    const badge = document.getElementById('reading-time');
    if (!content || !badge) return;
    const words = content.innerText.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(words / 200));
    badge.textContent = `${mins} min read`;
  };

  /* ── Init All ────────────────────────────────────────────── */
  initLoader();
  initScrollProgress();
  initNav();
  initBurger();
  initReveal();
  initCounters();
  initParallax();
  initSkillsStrip();
  initFlash();
  initForms();
  initSmoothScroll();
  initScrollParallax();
  initScrollTop();
  initReadingTime();

})();
