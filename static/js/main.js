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

    const hoverEls = 'a, button, .project-card, .cert-card, .tool-card, .mini-card, .stack-icon, .skill-tags span';
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

    const teal = '0, 212, 170';
    const violet = '139, 92, 246';
    let W, H, nodes, animId;

    const resize = () => {
      W = canvas.width  = hero.offsetWidth;
      H = canvas.height = hero.offsetHeight;
    };

    class Node {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.r  = Math.random() * 2 + 1;
        this.color = Math.random() > 0.7 ? violet : teal;
        this.life = Math.random();
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life += 0.003;
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${0.4 + Math.sin(this.life) * 0.2})`;
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      const count = Math.min(60, Math.floor(W * H / 15000));
      nodes = Array.from({ length: count }, () => new Node());
    };

    const connect = () => {
      const maxDist = 140;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.15;
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

    window.addEventListener('resize', debounce(() => { init(); }, 200));

    // Cleanup on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else tick();
    });
  };

  /* ── Hero Typing Effect ──────────────────────────────────── */
  const initTyping = () => {
    const cursor = document.querySelector('.hero__title-cursor');
    const outline = document.querySelector('.hero__title-outline');
    if (!cursor || !outline) return;

    const text = outline.dataset.text || outline.textContent.trim();
    outline.textContent = '';
    outline.appendChild(cursor);

    let i = 0;
    const type = () => {
      if (i <= text.length) {
        outline.textContent = text.slice(0, i);
        outline.appendChild(cursor);
        i++;
        setTimeout(type, 80);
      }
    };
    setTimeout(type, 600);
  };

  /* ── Number Counters ─────────────────────────────────────── */
  const initCounters = () => {
    const els = document.querySelectorAll('.stat__num, .hero__float-val, .counter, .stat-card__num');
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

  /* ── Skill Bar Animations ────────────────────────────────── */
  const initSkillBars = () => {
    const bars = document.querySelectorAll('.skill-bar__fill');
    if (!bars.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const target = e.target.dataset.width || '80%';
          setTimeout(() => { e.target.style.width = target; }, 200);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });

    bars.forEach(bar => obs.observe(bar));
  };

  /* ── Parallax / Mouse Movement ───────────────────────────── */
  const initParallax = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const glows = document.querySelectorAll('.hero__glow');
    const frame = document.querySelector('.hero__frame');
    if (!glows.length) return;

    const move = throttle((e) => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      const rx = (e.clientX - cx) / cx;
      const ry = (e.clientY - cy) / cy;
      glows.forEach((g, i) => {
        g.style.transform = `translate(${rx * (i + 1) * 12}px, ${ry * (i + 1) * 12}px)`;
      });
      if (frame) {
        frame.style.transform = `translate(${rx * -6}px, ${ry * -6}px)`;
      }
    }, 16);

    document.addEventListener('mousemove', move);
  };

  /* ── 3D Tilt ─────────────────────────────────────────────── */
  const initTilt = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const cards = document.querySelectorAll('.project-card, .cert-card, .tool-card, .mini-card');

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width  / 2;
        const cy = rect.height / 2;
        const rx = (y - cy) / 60;
        const ry = (cx - x) / 60;
        card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
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
  const initFlash = () => {
    document.querySelectorAll('.flash').forEach(flash => {
      setTimeout(() => {
        flash.style.opacity = '0';
        flash.style.transform = 'translateX(110%)';
        flash.style.transition = 'all 0.4s ease';
        setTimeout(() => flash.remove(), 420);
      }, 5000);

      const btn = flash.querySelector('.flash__close');
      if (btn) {
        btn.addEventListener('click', () => {
          flash.style.opacity = '0';
          flash.style.transform = 'translateX(110%)';
          flash.style.transition = 'all 0.3s ease';
          setTimeout(() => flash.remove(), 320);
        });
      }
    });
  };

  /* ── Confetti Effect ─────────────────────────────────────── */
  const confetti = (originX, originY) => {
    const canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;';
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const colors = ['#00d4aa','#00ffcc','#f59e0b','#8b5cf6','#ffffff','#f4f6fb'];
    const particles = Array.from({ length: 80 }, () => ({
      x: originX, y: originY,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      r: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      spin: (Math.random() - 0.5) * 12,
      gravity: 0.4,
      life: 1,
      decay: Math.random() * 0.012 + 0.01
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return;
        alive = true;
        p.vy += p.gravity;
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot += p.spin;
        p.life -= p.decay;

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r * 2);
        ctx.restore();
      });
      if (alive) requestAnimationFrame(draw);
      else canvas.remove();
    };
    requestAnimationFrame(draw);
  };

  /* ── Resume Button ───────────────────────────────────────── */
  const initResume = () => {
    document.querySelectorAll('.btn-resume, [data-resume]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rect = btn.getBoundingClientRect();
        confetti(rect.left + rect.width/2, rect.top + rect.height/2);
      });
    });
  };

  /* ── Form Focus Effects ──────────────────────────────────── */
  const initForms = () => {
    document.querySelectorAll('.form-control').forEach(input => {
      const g = input.closest('.form-group');
      if (!g) return;
      input.addEventListener('focus',  () => g.classList.add('focused'));
      input.addEventListener('blur',   () => g.classList.remove('focused'));
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

  /* ── Lazy Image Fade ─────────────────────────────────────── */
  const initLazy = () => {
    const imgs = document.querySelectorAll('img[loading="lazy"]');
    if (!imgs.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const img = e.target;
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.5s ease';
        const show = () => { img.style.opacity = '1'; };
        if (img.complete) show();
        else img.addEventListener('load', show, { once: true });
        obs.unobserve(img);
      });
    }, { threshold: 0.05 });

    imgs.forEach(i => obs.observe(i));
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

  /* ── Timeline Line Animation ─────────────────────────────── */
  const initTimeline = () => {
    const track = document.querySelector('.timeline__track');
    if (!track) return;
    const before = track.querySelector('::before');
    // Animate items staggered
    track.querySelectorAll('.timeline__item').forEach((item, i) => {
      item.style.transitionDelay = `${i * 80}ms`;
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

  /* ── Reduced Motion ──────────────────────────────────────── */
  const respectReducedMotion = () => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
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
  initCursor();
  initScrollProgress();
  initNav();
  initBurger();
  initReveal();
  initHeroCanvas();
  initTyping();
  initCounters();
  initSkillBars();
  initParallax();
  initTilt();
  initSkillsStrip();
  initFlash();
  initResume();
  initForms();
  initCopy();
  initLazy();
  initSmoothScroll();
  initTimeline();
  initMagnetic();
  respectReducedMotion();
  initConsole();

})();
