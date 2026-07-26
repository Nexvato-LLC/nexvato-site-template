'use client';

import { useRouter } from 'next/navigation';
import { JAYS_DATA } from '@/lib/data';
import { useCart } from '@/components/CartProvider';
import { useSiteContent } from '@/components/ContentProvider';
import Eyebrow from '@/components/ds/Eyebrow';

/**
 * BrandRoster — the home "Shop by Brands" band, redesigned as "The Roster":
 * a static, ruled navy grid where every brand is a giant Anton wordmark link.
 * All 8 always visible (no marquee); each is a real <a href="/shop?brand=…">
 * with a live product count. Hover fills the wordmark with a gold-foil sweep
 * and dims the rest (CSS in globals.css). Honors reduced motion via the global net.
 */
export default function BrandRoster() {
  const router = useRouter();
  const { catalog } = useCart();
  const { home } = useSiteContent();
  const heading = home?.brands || {};
  const brands = JAYS_DATA.brands;
  // A brand-new site has no brands configured yet. Render nothing rather than
  // an empty band — an unfinished section looks worse than a missing one.
  if (!brands || brands.length === 0) return null;
  const count = (b) => catalog.filter((p) => p.brand === b).length;
  const go = (b) => (e) => {
    e.preventDefault();
    router.push('/shop?brand=' + encodeURIComponent(b));
  };

  return (
    <section data-band style={{ position: 'relative', overflow: 'hidden', background: 'var(--navy-900)', padding: '96px 0' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(58% 55% at 50% 0%, rgba(224,180,94,0.10), transparent 70%)' }} />
      <div style={{ position: 'relative', maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px' }}>
        <div data-rise style={{ textAlign: 'center', marginBottom: 40 }}>
          <Eyebrow color="onDark" rule>{heading.eyebrow || 'Shop by Brand'}</Eyebrow>
          <h2 style={{ margin: '12px 0 0', fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,4.6vw,58px)', textTransform: 'uppercase', lineHeight: 0.98, color: 'var(--white)' }}>
            {heading.title || 'The Roster'}
          </h2>
          <p style={{ margin: '12px auto 0', maxWidth: 520, fontSize: 15, lineHeight: 1.6, color: 'var(--text-on-dark-muted)' }}>
            {heading.subtitle || 'Authentic gear from the names that built the American game.'}
          </p>
        </div>

        <div
          className="roster"
          data-rise
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
            borderTop: '1px solid rgba(255,255,255,0.12)',
            borderLeft: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {brands.map((b) => {
            const n = count(b);
            return (
              <a
                key={b}
                className="roster-cell"
                href={'/shop?brand=' + encodeURIComponent(b)}
                onClick={go(b)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 18,
                  minHeight: 150,
                  padding: '26px 26px',
                  textDecoration: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.12)',
                  borderBottom: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <span className="roster-name" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,3.2vw,44px)', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                  {b}
                </span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(230,200,140,0.78)' }}>
                  {n} item{n === 1 ? '' : 's'}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
