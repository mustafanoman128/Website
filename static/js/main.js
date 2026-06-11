/* ============================================================
   MUSTAFA NOMAN — TERMINAL NOIR × DATA LUXURY
   main.js v3.0 — Premium Interactions
   ============================================================ */

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

  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
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

  /* ── Custom Cursor ───────────────────────────────────────── */
  const initCursor = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    const follower = document.createElement('div');
    follower.className = 'cursor-follower';
    document.body.append(cursor, follower);

    let mx = -100, my = -100, fx = -100, fy = -100;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      cursor.style.left = mx + 'px';
      cursor.style.top  = my + 'px';
    });

    const followCursor = () => {
      fx += (mx - fx) * 0.12;
      fy += (my - fy) * 0.12;
      follower.style.left = fx + 'px';
      follower.style.top  = fy + 'px';
      requestAnimationFrame(followCursor);
    };
    followCursor();

    const hoverEls = 'a, button, .project-card, .cert-card, .stack-icon, .skill-tags span';
    document.querySelectorAll(hoverEls).forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
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
    const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
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

  /* ── Hero Canvas Particles ───────────────────────────────── */
  const initHeroCanvas = () => {
    const hero = document.getElementById('hero');
    if (!hero) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
    hero.prepend(canvas);
    const ctx = canvas.getContext('2d');

    const teal = '0, 229, 184';
    const violet = '168, 85, 247';
    const amber = '245, 158, 11';
    let W, H, nodes, animId;
    let _mx = null, _my = null;

    hero.addEventListener('mousemove', e => { _mx = e.clientX; _my = e.clientY; });
    hero.addEventListener('mouseleave', () => { _mx = null; _my = null; });

    const resize = () => {
      W = canvas.width  = hero.offsetWidth;
      H = canvas.height = hero.offsetHeight;
    };

    class Node {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.r  = Math.random() * 2 + 1;
        const rand = Math.random();
        this.color = rand > 0.91 ? amber : rand > 0.82 ? violet : teal;
        this.life = Math.random();
      }
      update() {
        if (_mx !== null) {
          const rect = canvas.getBoundingClientRect();
          const mx = _mx - rect.left;
          const my = _my - rect.top;
          const dx = this.x - mx, dy = this.y - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) { const f = (90 - d) / 90 * 0.28; this.vx += (dx / d) * f; this.vy += (dy / d) * f; }
        }
        this.vx *= 0.98; this.vy *= 0.98;
        this.x += this.vx;
        this.y += this.vy;
        this.life += 0.003;
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${0.55 + Math.sin(this.life) * 0.25})`;
        ctx.fill();
      }
    }

    const isMobile = window.matchMedia('(pointer: coarse)').matches;

    const init = () => {
      resize();
      const count = isMobile
        ? Math.min(35, Math.floor(W * H / 20000))
        : Math.min(140, Math.floor(W * H / 8000));
      nodes = Array.from({ length: count }, () => new Node());
    };

    const connect = () => {
      const maxDist = isMobile ? 110 : 180;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.28;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${teal}, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
    };

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      nodes.forEach(n => { n.update(); n.draw(); });
      connect();
      animId = requestAnimationFrame(tick);
    };

    init();
    tick();

    window.addEventListener('resize', debounce(init, 200));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else tick();
    });
  };

  /* ── Hero Word Cycler ────────────────────────────────────── */
  const initHeroWord = () => {
    const outline = document.querySelector('.hero__title-outline');
    if (!outline) return;
    const words = ['Data', 'Numbers', 'Insights', 'Stories', 'Patterns'];
    const chars = '!<>-_\\/[]{}—=+*^?#@$%';
    let idx = 0;

    const scramble = (target, cb) => {
      let iter = 0;
      const total = target.length * 3;
      const iv = setInterval(() => {
        outline.textContent = Array.from(target).map((ch, i) =>
          i < Math.floor(iter / 3)
            ? ch
            : chars[Math.floor(Math.random() * chars.length)]
        ).join('');
        if (++iter >= total) { clearInterval(iv); outline.textContent = target; cb && cb(); }
      }, 35);
    };

    const cycle = () => {
      idx = (idx + 1) % words.length;
      scramble(words[idx], () => setTimeout(cycle, 2800));
    };
    setTimeout(cycle, 3000);
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

  /* ── 3D Tilt ─────────────────────────────────────────────── */
  const initTilt = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const cards = document.querySelectorAll(
      '.project-card, .cert-card, .cert-detail-card, .timeline__card, .edu-card, .skill-group'
    );

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width  / 2;
        const cy = rect.height / 2;
        const rx = (y - cy) / 50;
        const ry = (cx - x) / 50;
        card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1200px) rotateX(0) rotateY(0) translateY(0)';
        card.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        setTimeout(() => { card.style.transition = ''; }, 500);
      });
    });
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

  /* ── Copy Contact Details ────────────────────────────────── */
  const initCopy = () => {
    document.querySelectorAll('.contact-detail__val').forEach(el => {
      el.style.cursor = 'pointer';
      el.title = 'Click to copy';
      el.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(el.textContent);
          const orig = el.textContent;
          el.textContent = '✓ Copied!';
          el.style.color = 'var(--teal)';
          setTimeout(() => { el.textContent = orig; el.style.color = ''; }, 1600);
        } catch (_) {}
      });
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

  /* ── Magnetic Buttons ────────────────────────────────────── */
  const initMagnetic = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    document.querySelectorAll('.btn--primary, .btn--hero').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width/2);
        const dy = e.clientY - (rect.top + rect.height/2);
        btn.style.transform = `translate(${dx * 0.2}px, ${dy * 0.2}px) scale(1.03)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        btn.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        setTimeout(() => btn.style.transition = '', 400);
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

    const heroCanvas = document.querySelector('.hero__canvas');
    if (heroCanvas) {
      gsap.to(heroCanvas, {
        opacity: 0,
        scrollTrigger: { trigger: '.hero', start: '60% top', end: 'bottom top', scrub: true }
      });
    }

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

  /* ── Console Signature ───────────────────────────────────── */
  const initConsole = () => {
    const styles = [
      'background:linear-gradient(90deg,#0a0c10,#11141a);color:#00d4aa;font-size:14px;font-weight:bold;padding:12px 20px;border-radius:6px;border-left:4px solid #00d4aa;',
      'color:#00d4aa;font-size:11px;',
      'color:#5a6680;font-size:10px;'
    ];
    console.log('%c ❯ Mustafa Noman — Data Analyst ', styles[0]);
    console.log('%c Revenue Ops · BI · ML · Chicago ', styles[1]);
    console.log('%c mustafanoman128@gmail.com ', styles[2]);
  };

  /* ── Init All ────────────────────────────────────────────── */
  initLoader();
  initCursor();
  initScrollProgress();
  initNav();
  initBurger();
  initReveal();
  initHeroCanvas();
  initHeroWord();
  initCounters();
  initParallax();
  initTilt();
  initSkillsStrip();
  initFlash();
  initForms();
  initCopy();
  initSmoothScroll();
  initScrollParallax();
  initMagnetic();
  initScrollTop();
  initReadingTime();
  initConsole();

})();
