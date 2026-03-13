/* ============================================================
   MUSTAFA NOMAN PORTFOLIO — main.js
   Nature-Inspired Interactions & Animations
   ============================================================ */

(function () {
  'use strict';

  /* ── Utility: Throttle Function ───────────────────────────── */
  const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  /* ── Utility: Debounce Function ───────────────────────────── */
  const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  /* ── Scroll-Based Nav ──────────────────────────────────────── */
  const nav = document.getElementById('nav');
  if (nav) {
    let lastScroll = 0;
    const scrollThreshold = 50;
    
    const onScroll = throttle(() => {
      const currentScroll = window.scrollY;
      
      // Add/remove scrolled class
      nav.classList.toggle('scrolled', currentScroll > scrollThreshold);
      
      // Hide/show nav on scroll direction
      if (currentScroll > 300) {
        if (currentScroll > lastScroll) {
          nav.style.transform = 'translateY(-100%)';
        } else {
          nav.style.transform = 'translateY(0)';
        }
      } else {
        nav.style.transform = 'translateY(0)';
      }
      
      lastScroll = currentScroll;
    }, 100);
    
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    
    // Smooth transition for nav transform
    nav.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s, backdrop-filter 0.3s';
  }

  /* ── Mobile Burger Menu ────────────────────────────────────── */
  const burger = document.getElementById('navBurger');
  const links = document.getElementById('navLinks');
  
  if (burger && links) {
    burger.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      burger.classList.toggle('active', isOpen);
      burger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    
    // Close on link click
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        burger.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        burger.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── Intersection Observer — Scroll Reveal ─────────────────── */
  const initRevealAnimations = () => {
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    
    if (!revealElements.length) return;
    
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay) || 0;
          
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);
          
          revealObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);
    
    // Observe elements and set stagger delays for siblings
    const parentGroups = new Map();
    
    revealElements.forEach((el) => {
      const parent = el.parentElement;
      if (parent) {
        if (!parentGroups.has(parent)) {
          parentGroups.set(parent, 0);
        }
        const index = parentGroups.get(parent);
        el.dataset.delay = index * 100;
        parentGroups.set(parent, index + 1);
      }
      revealObserver.observe(el);
    });
  };
  
  initRevealAnimations();

  /* ── Parallax Effect for Hero ──────────────────────────────── */
  const initParallax = () => {
    const heroGlows = document.querySelectorAll('.hero__glow');
    const heroFrame = document.querySelector('.hero__frame');
    
    if (!heroGlows.length && !heroFrame) return;
    
    // Check for touch device
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) return;
    
    const handleMouseMove = throttle((e) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      const moveX = (clientX - centerX) / centerX;
      const moveY = (clientY - centerY) / centerY;
      
      heroGlows.forEach((glow, index) => {
        const factor = (index + 1) * 15;
        glow.style.transform = `translate(${moveX * factor}px, ${moveY * factor}px)`;
      });
      
      if (heroFrame) {
        heroFrame.style.transform = `translate(${moveX * -8}px, ${moveY * -8}px)`;
      }
    }, 16);
    
    document.addEventListener('mousemove', handleMouseMove);
  };
  
  initParallax();

  /* ── Flash Auto-Dismiss ────────────────────────────────────── */
  const initFlashMessages = () => {
    document.querySelectorAll('.flash').forEach(flash => {
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        flash.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        flash.style.opacity = '0';
        flash.style.transform = 'translateX(110%)';
        setTimeout(() => flash.remove(), 420);
      }, 5000);
      
      // Close button functionality
      const closeBtn = flash.querySelector('.flash__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          flash.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          flash.style.opacity = '0';
          flash.style.transform = 'translateX(110%)';
          setTimeout(() => flash.remove(), 320);
        });
      }
    });
  };
  
  initFlashMessages();

  /* ── Animated Number Counter ───────────────────────────────── */
  const initNumberCounters = () => {
    const statNums = document.querySelectorAll('.stat__num, .hero__float-val, .counter');
    
    if (!statNums.length) return;
    
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
    
    const animateNum = (el) => {
      const text = el.textContent;
      const match = text.match(/([\$]?)([\d,.]+)([KM%+]*)/);
      if (!match) return;
      
      const prefix = match[1] || '';
      const target = parseFloat(match[2].replace(/,/g, ''));
      const suffix = match[3] || '';
      const duration = 1800;
      const start = performance.now();
      
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const easedProgress = easeOutQuart(progress);
        const val = target * easedProgress;
        
        let display;
        if (target >= 1000) {
          display = Math.floor(val).toLocaleString('en-US');
        } else if (target % 1 !== 0) {
          display = val.toFixed(1);
        } else {
          display = Math.floor(val);
        }
        
        el.textContent = prefix + display + suffix;
        
        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      };
      
      requestAnimationFrame(tick);
    };
    
    const numObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateNum(entry.target);
          numObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    statNums.forEach(el => numObserver.observe(el));
  };
  
  initNumberCounters();

  /* ── Smooth Scroll for Anchor Links ────────────────────────── */
  const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          const navHeight = nav ? nav.offsetHeight : 0;
          const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - navHeight - 20;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  };
  
  initSmoothScroll();

  /* ── Form Input Focus Effects ──────────────────────────────── */
  const initFormEffects = () => {
    document.querySelectorAll('.form-control').forEach(input => {
      const formGroup = input.closest('.form-group');
      if (!formGroup) return;
      
      input.addEventListener('focus', () => {
        formGroup.classList.add('focused');
      });
      
      input.addEventListener('blur', () => {
        formGroup.classList.remove('focused');
      });
    });
  };
  
  initFormEffects();

  /* ── Card Hover Tilt Effect (Desktop Only) ─────────────────── */
  const initTiltEffect = () => {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) return;
    
    const tiltElements = document.querySelectorAll('.project-card, .cert-card, .tool-card, .mini-card');
    
    tiltElements.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
      });
    });
  };
  
  initTiltEffect();

  /* ── Skills Strip Pause on Hover ───────────────────────────── */
  const initSkillsStrip = () => {
    const skillsStrip = document.querySelector('.skills-strip__track');
    if (skillsStrip) {
      const parent = skillsStrip.closest('.skills-strip');
      if (parent) {
        parent.addEventListener('mouseenter', () => {
          skillsStrip.style.animationPlayState = 'paused';
        });
        parent.addEventListener('mouseleave', () => {
          skillsStrip.style.animationPlayState = 'running';
        });
      }
    }
  };
  
  initSkillsStrip();

  /* ── Image Lazy Loading with Fade ──────────────────────────── */
  const initLazyImages = () => {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    
    if (!lazyImages.length) return;
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.style.opacity = '0';
          img.style.transition = 'opacity 0.5s ease';
          
          if (img.complete) {
            img.style.opacity = '1';
          } else {
            img.addEventListener('load', () => {
              img.style.opacity = '1';
            });
          }
          
          imageObserver.unobserve(img);
        }
      });
    }, { threshold: 0.1 });
    
    lazyImages.forEach(img => imageObserver.observe(img));
  };
  
  initLazyImages();

  /* ── Copy to Clipboard for Contact Details ─────────────────── */
  const initCopyToClipboard = () => {
    document.querySelectorAll('.contact-detail__val').forEach(el => {
      el.style.cursor = 'pointer';
      el.title = 'Click to copy';
      
      el.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(el.textContent);
          
          const originalText = el.textContent;
          el.textContent = 'Copied!';
          el.style.color = 'var(--accent-bright)';
          
          setTimeout(() => {
            el.textContent = originalText;
            el.style.color = '';
          }, 1500);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
    });
  };
  
  initCopyToClipboard();

  /* ── Active Nav Link on Scroll ─────────────────────────────── */
  const initActiveNavOnScroll = () => {
    const sections = document.querySelectorAll('section[id]');
    if (!sections.length) return;
    
    const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
    if (!navLinks.length) return;
    
    const observerOptions = {
      threshold: 0.3,
      rootMargin: '-100px 0px -50% 0px'
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            }
          });
        }
      });
    }, observerOptions);
    
    sections.forEach(section => sectionObserver.observe(section));
  };
  
  initActiveNavOnScroll();

  /* ── Prefers Reduced Motion ────────────────────────────────── */
  const respectReducedMotion = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
      document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }
  };
  
  respectReducedMotion();

  /* ─── Leaf Particle Effect (Nature Theme) ──────────────────── */
  const initLeafParticles = () => {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) return;
    
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    // Create subtle floating particles
    const createParticle = () => {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: rgba(107, 196, 107, 0.3);
        border-radius: 50%;
        pointer-events: none;
        z-index: 0;
      `;
      
      const startX = Math.random() * 100;
      const duration = 15 + Math.random() * 10;
      
      particle.style.left = `${startX}%`;
      particle.style.top = '100%';
      particle.style.animation = `floatParticle ${duration}s linear infinite`;
      
      hero.appendChild(particle);
      
      // Remove after animation
      setTimeout(() => {
        particle.remove();
      }, duration * 1000);
    };
    
    // Add particle animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes floatParticle {
        0% {
          transform: translateY(0) translateX(0);
          opacity: 0;
        }
        10% {
          opacity: 0.6;
        }
        90% {
          opacity: 0.6;
        }
        100% {
          transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Create particles periodically
    setInterval(createParticle, 3000);
  };
  
  initLeafParticles();

  /* ─── Organic Wave Animation for Sections ──────────────────── */
  const initOrganicWaves = () => {
    const sections = document.querySelectorAll('.section--dark');
    
    sections.forEach(section => {
      const wave = document.createElement('div');
      wave.style.cssText = `
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        height: 60px;
        background: linear-gradient(to bottom, var(--forest-deep), transparent);
        pointer-events: none;
        z-index: 1;
      `;
      section.appendChild(wave);
    });
  };
  
  initOrganicWaves();

  /* ─── Console Welcome Message ───────────────────────────────── */
  console.log('%c 🌿 Mustafa Noman ', 'background: linear-gradient(135deg, #4a9a4a, #2a8a7a); color: #f5f0e8; font-size: 16px; font-weight: bold; padding: 8px 16px; border-radius: 8px;');
  console.log('%c Data Analyst & Business Intelligence ', 'color: #6bc46b; font-size: 12px;');
  console.log('%c Welcome to my nature-inspired portfolio! ', 'color: #7a9a7a; font-size: 11px;');

})();
