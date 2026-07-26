'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * RouteWipe — a flag-colored cover that sweeps away to reveal each new route
 * (red leading edge over navy). Reuses window.gsap (already loaded
 * beforeInteractive). Skips the very first paint and all reduced-motion cases.
 */
export default function RouteWipe() {
  const ref = useRef(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    const g = window.gsap;
    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.__JAYS_FORCE_REDUCED === true;
    if (!el || !g || reduced) return;

    g.set(el, { autoAlpha: 1, scaleX: 1, transformOrigin: 'right center' });
    g.to(el, {
      scaleX: 0,
      duration: 0.55,
      ease: 'power3.inOut',
      onComplete: () => g.set(el, { autoAlpha: 0 }),
    });
  }, [pathname]);

  return <div ref={ref} aria-hidden="true" className="route-wipe" />;
}
