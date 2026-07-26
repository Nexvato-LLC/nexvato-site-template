/* Nexvato Site Template — GSAP motion layer.
   Identity: quick & snappy, 120–360ms, power2/power3/expo ease-out, no bounce.
   Full prefers-reduced-motion path: everything renders static, no hidden states. */
window.SiteMotion = (function () {
  const reduced = () =>
    window.__JAYS_FORCE_REDUCED === true ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hasGsap = () => !!window.gsap;

  function registerPlugins() {
    if (!hasGsap()) return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
  }

  /* ---- Per-route scroll choreography. Returns a revert() fn. ----
     Reveals use per-element IntersectionObserver (NOT ScrollTrigger `from`
     tweens) so late-hydrating components or re-renders can never strand
     content at opacity 0. Safe to call repeatedly: revealed elements are
     flagged and skipped. */
  function initPage(root) {
    root = root || document;
    if (!hasGsap() || reduced()) {
      /* make sure nothing is left hidden from a previous motion pass */
      root.querySelectorAll('[data-rise],[data-split],[data-grid] > *,.site-line').forEach((el) => {
        el.style.opacity = ''; el.style.visibility = ''; el.style.transform = '';
      });
      return () => {};
    }
    registerPlugins();
    const observers = [];
    const watch = (el, fn) => {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
      io.observe(el);
      observers.push(io);
    };
    const riseIn = (el, delay) => {
      if (el.dataset.siteRevealed) return;
      gsap.set(el, { autoAlpha: 0, y: 20 });
      watch(el, () => {
        el.dataset.siteRevealed = '1';
        gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.36, ease: 'power2.out', delay: delay || 0, clearProps: 'transform,visibility' });
      });
    };

    /* Anton headline reveals — line mask + short rise */
    root.querySelectorAll('[data-split]').forEach((el) => {
      if (el.dataset.siteRevealed) return;
      if (window.SplitText && !el.dataset.siteSplit) {
        try {
          const split = new SplitText(el, { type: 'lines', linesClass: 'site-line' });
          el.dataset.siteSplit = '1';
          split.lines.forEach((l) => {
            const wrap = document.createElement('span');
            wrap.style.cssText = 'display:block;overflow:hidden;';
            l.parentNode.insertBefore(wrap, l);
            wrap.appendChild(l);
            l.style.display = 'block';
          });
        } catch (e) { /* fall through to rise treatment */ }
      }
      const lines = el.querySelectorAll('.site-line');
      if (lines.length) {
        gsap.set(lines, { yPercent: 105 });
        watch(el, () => {
          el.dataset.siteRevealed = '1';
          gsap.to(lines, { yPercent: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07 });
        });
      } else {
        riseIn(el);
      }
    });

    /* Band choreography — children fade + rise in a tight stagger */
    root.querySelectorAll('[data-band]').forEach((band) => {
      band.querySelectorAll('[data-rise]').forEach((el, i) => riseIn(el, Math.min(i * 0.07, 0.35)));
    });
    root.querySelectorAll('[data-rise]').forEach((el) => { if (!el.closest('[data-band]')) riseIn(el); });

    /* Product grid stagger */
    root.querySelectorAll('[data-grid]').forEach((grid) => {
      Array.from(grid.children).forEach((card, i) => riseIn(card, Math.min((i % 4) * 0.06, 0.3)));
    });

    /* Cause counters — count up on enter */
    root.querySelectorAll('[data-count]').forEach((el) => {
      if (el.dataset.siteRevealed) return;
      const target = parseFloat(el.getAttribute('data-count')) || 0;
      const suffix = el.getAttribute('data-count-suffix') || '';
      el.textContent = '0' + suffix;
      watch(el, () => {
        el.dataset.siteRevealed = '1';
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1.4, ease: 'power2.out',
          onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString('en-US') + suffix; },
        });
      });
    });

    const ctx = gsap.context(() => {
      /* Promo tile parallax — circle imagery drifts subtly on scroll */
      root.querySelectorAll('[data-parallax-img]').forEach((el) => {
        gsap.fromTo(el, { yPercent: -6 }, {
          yPercent: 6, ease: 'none',
          scrollTrigger: { trigger: el.closest('[data-parallax-zone]') || el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        });
      });

      /* Magnetic red CTA — subtle pull within a small radius */
      if (window.matchMedia('(hover: hover)').matches) {
        root.querySelectorAll('[data-magnetic]').forEach((el) => {
          const strength = 0.28, radius = 110;
          const qx = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3.out' });
          const qy = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3.out' });
          const move = (e) => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const dx = e.clientX - cx, dy = e.clientY - cy;
            const dist = Math.hypot(dx, dy);
            if (dist < radius + Math.max(r.width, r.height) / 2) {
              qx(dx * strength); qy(dy * strength);
            } else { qx(0); qy(0); }
          };
          const leave = () => { qx(0); qy(0); };
          window.addEventListener('pointermove', move);
          el.addEventListener('pointerleave', leave);
        });
      }
    }, root === document ? undefined : root);

    return () => {
      observers.forEach((io) => io.disconnect());
      ctx.revert();   /* kills parallax scrub triggers; reveals are left as-is */
    };
  }

  /* ---- Sticky header: compacts on scroll; hides down, reveals up ---- */
  function header(headerEl, barEl, logoEl) {
    if (!hasGsap() || reduced() || !headerEl) return () => {};
    registerPlugins();
    let compact = false, hidden = false, lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY + 2;
      const goingUp = y < lastY - 2;
      if (y > 60 && !compact) {
        compact = true;
        gsap.to(barEl, { paddingTop: 7, paddingBottom: 7, duration: 0.24, ease: 'power2.out' });
        gsap.to(logoEl, { scale: 0.8, duration: 0.24, ease: 'power2.out' });
        gsap.to(headerEl, { boxShadow: '0 1px 0 rgba(228,230,233,1), 0 6px 18px rgba(16,35,61,0.08)', duration: 0.24 });
      } else if (y <= 60 && compact) {
        compact = false;
        gsap.to(barEl, { paddingTop: 14, paddingBottom: 14, duration: 0.24, ease: 'power2.out' });
        gsap.to(logoEl, { scale: 1, duration: 0.24, ease: 'power2.out' });
        gsap.to(headerEl, { boxShadow: '0 0 0 rgba(0,0,0,0)', duration: 0.24 });
      }
      if (y > 240 && goingDown && !hidden) {
        hidden = true;
        gsap.to(headerEl, { yPercent: -101, duration: 0.3, ease: 'power3.out' });
      } else if ((goingUp || y <= 240) && hidden) {
        hidden = false;
        gsap.to(headerEl, { yPercent: 0, duration: 0.3, ease: 'power3.out' });
      }
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }

  /* ---- Cart drawer timeline ---- */
  function cart(open, els) {
    const { scrim, panel } = els;
    if (!scrim || !panel) return;
    const items = panel.querySelectorAll('[data-cart-item]');
    const foot = panel.querySelector('[data-cart-foot]');
    if (!hasGsap() || reduced()) {
      scrim.style.opacity = open ? '1' : '0';
      scrim.style.pointerEvents = open ? 'auto' : 'none';
      panel.style.transform = open ? 'translateX(0%)' : 'translateX(103%)';
      items.forEach((i) => { i.style.opacity = '1'; i.style.transform = 'none'; });
      if (foot) { foot.style.opacity = '1'; }
      return;
    }
    gsap.killTweensOf([scrim, panel, items, foot]);
    if (open) {
      const tl = gsap.timeline();
      tl.set(scrim, { pointerEvents: 'auto' })
        .to(scrim, { opacity: 1, duration: 0.24, ease: 'power2.out' }, 0)
        .to(panel, { x: '0%', duration: 0.36, ease: 'power3.out' }, 0.02);
      if (items.length) tl.fromTo(items, { autoAlpha: 0, x: 22 }, { autoAlpha: 1, x: 0, duration: 0.26, ease: 'power2.out', stagger: 0.05 }, 0.16);
      if (foot) tl.fromTo(foot, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out' }, 0.3);
    } else {
      gsap.to(scrim, { opacity: 0, duration: 0.2, ease: 'power2.out' });
      gsap.set(scrim, { pointerEvents: 'none' });
      gsap.to(panel, { x: '103%', duration: 0.3, ease: 'power3.out' });
    }
  }

  /* ---- Route transition: flag-color cover wipe ---- */
  function wipe(el, cb) {
    if (!hasGsap() || reduced() || !el) { cb(); return; }
    gsap.killTweensOf(el);
    const tl = gsap.timeline();
    tl.set(el, { transformOrigin: 'left center', scaleX: 0, display: 'block' })
      .to(el, { scaleX: 1, duration: 0.22, ease: 'power2.in' })
      .add(() => cb())
      .set(el, { transformOrigin: 'right center' })
      .to(el, { scaleX: 0, duration: 0.3, ease: 'power3.out', delay: 0.04 })
      .set(el, { display: 'none' });
  }

  /* ---- Brand chip marquee: slow drift, draggable scrub ---- */
  function marquee(track) {
    if (!track) return () => {};
    if (!hasGsap() || reduced()) return () => {};
    let x = 0, half = 0, dragging = false, lastPX = 0, vel = 0, paused = false;
    const measure = () => { half = track.scrollWidth / 2; };
    measure();
    const onDown = (e) => { dragging = true; lastPX = e.clientX; track.style.cursor = 'grabbing'; };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastPX; lastPX = e.clientX;
      x += dx; vel = dx;
    };
    const onUp = () => { dragging = false; track.style.cursor = 'grab'; };
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    track.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    track.addEventListener('pointerenter', onEnter);
    track.addEventListener('pointerleave', onLeave);
    track.style.cursor = 'grab';
    const tick = () => {
      if (!half) measure();
      if (!dragging) {
        vel *= 0.92;
        x += vel + (paused ? 0 : -0.45);
      }
      if (half > 0) {
        if (x <= -half) x += half;
        if (x > 0) x -= half;
      }
      gsap.set(track, { x });
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      track.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      track.removeEventListener('pointerenter', onEnter);
      track.removeEventListener('pointerleave', onLeave);
    };
  }

  return { reduced, initPage, header, cart, wipe, marquee };
})();
