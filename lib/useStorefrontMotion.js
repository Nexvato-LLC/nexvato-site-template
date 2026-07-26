'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Drives the vanilla window.SiteMotion / window.SiteFX layer for the current
 * route. Ported from the source `class Component`'s `componentDidMount` poll
 * + `_mountPage` / `_teardownPage` (initPage reveals, canvas[data-fx] effects,
 * brand marquee). Re-runs whenever the pathname changes, since route changes
 * in the original single-page component were driven by `_go()` re-rendering
 * the same tree instead of a real navigation.
 */
export default function useStorefrontMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let cancelled = false;
    let pollId = null;
    let lateTimerId = null;
    let revert = () => {};
    let marqOff = () => {};
    let fxDisposers = [];

    const teardownFx = () => {
      fxDisposers.forEach((d) => {
        try { d(); } catch (e) { /* noop */ }
      });
      fxDisposers = [];
      try { revert(); } catch (e) { /* noop */ }
      revert = () => {};
      try { marqOff(); } catch (e) { /* noop */ }
      marqOff = () => {};
    };

    const mount = () => {
      if (cancelled) return;
      teardownFx();
      revert = window.SiteMotion?.initPage(document) || (() => {});
      document.querySelectorAll('canvas[data-fx]').forEach((c) => {
        const kind = c.getAttribute('data-fx');
        let d = null;
        if (kind === 'hero') d = window.SiteFX?.heroLiquid(c, '/assets/graphic-hero.svg');
        if (kind === 'dots') d = window.SiteFX?.dots(c);
        if (kind === 'stars') d = window.SiteFX?.starfield(c);
        if (kind === 'viewer') d = window.SiteFX?.viewer(c);
        if (d) fxDisposers.push(d);
      });
      const marq = document.getElementById('site-marquee');
      if (marq && window.SiteMotion) marqOff = window.SiteMotion.marquee(marq);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    };

    let tries = 0;
    pollId = setInterval(() => {
      tries++;
      const ready = window.gsap && window.SiteFX && window.SiteMotion;
      if (ready || tries > 80) {
        clearInterval(pollId);
        pollId = null;
        requestAnimationFrame(mount);
        /* re-run once more to catch late paints — idempotent, SiteMotion
           flags already-revealed elements so this never double-animates */
        lateTimerId = setTimeout(mount, 700);
      }
    }, 120);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (lateTimerId) clearTimeout(lateTimerId);
      teardownFx();
    };
  }, [pathname]);
}
