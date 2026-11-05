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
  // Shown on the first page of a browser session only; base.html's head script sets
  // .return-visit (CSS hides the loader) so later pages render instantly, without the entrance.
  const initLoader = () => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    if (document.documentElement.classList.contains('return-visit')) { loader.remove(); return; }
    try { sessionStorage.setItem('mn-visited', '1'); } catch (e) { /* storage blocked: loader shows each time */ }
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

  /* ── Scroll Progress (reading progress on blog posts) ───── */
  const initScrollProgress = () => {
    if (!document.querySelector('.post-content')) return;
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
    const onScroll = throttle(() => {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 40);
      // '' rather than translateY(0): any transform would trap the fixed mobile menu inside the nav
      nav.style.transform = y > 300 && y > lastY ? 'translateY(-100%)' : '';
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

    const setOpen = open => {
      links.classList.toggle('open', open);
      burger.classList.toggle('active', open);
      burger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };

    burger.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && links.classList.contains('open')) setOpen(false);
    });
  };

  /* ── Scroll Reveal ───────────────────────────────────────── */
  const initReveal = () => {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    // stagger siblings: the nth .reveal inside the same parent waits n × 80ms
    const delays = new Map();
    const siblingsSeen = new Map();
    els.forEach(el => {
      const idx = siblingsSeen.get(el.parentElement) || 0;
      delays.set(el, idx * 80);
      siblingsSeen.set(el.parentElement, idx + 1);
    });

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        setTimeout(() => entry.target.classList.add('visible'), delays.get(entry.target));
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    els.forEach(el => obs.observe(el));
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

    // Submit feedback: disable the button so a slow mail send can't be double-submitted
    document.querySelectorAll('form').forEach(form => {
      const btn = form.querySelector('[type="submit"]');
      if (!btn) return;
      const label = btn.firstChild.textContent;
      form.addEventListener('submit', () => { btn.disabled = true; btn.firstChild.textContent = 'Sending… '; });
      // a page restored from the back/forward cache keeps the disabled state otherwise
      window.addEventListener('pageshow', () => { btn.disabled = false; btn.firstChild.textContent = label; });
    });
  };

  /* ── Smooth Scroll ───────────────────────────────────────── */
  const initSmoothScroll = () => {
    const nav = document.getElementById('nav');
    document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach(a => {
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
    const words = content.innerText.trim().split(/\s+/).length;
    const mins = Math.max(1, Math.round(words / 200));
    badge.textContent = `${mins} min read`;
  };

  /* ── Init All ────────────────────────────────────────────── */
  initLoader();
  initScrollProgress();
  initNav();
  initBurger();
  initReveal();
  initFlash();
  initForms();
  initSmoothScroll();
  initScrollTop();
  initReadingTime();

})();
