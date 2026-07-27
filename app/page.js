'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/components/CartProvider';
import { useSiteContent } from '@/components/ContentProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import SectionHeading from '@/components/ds/SectionHeading';
import ProductCard from '@/components/ds/ProductCard';
import PromoCard from '@/components/ds/PromoCard';
import BrandRoster from '@/components/sections/BrandRoster';
import Services from '@/components/sections/Services';
import Contact from '@/components/sections/Contact';
import { HAS_COMMERCE, resolveUrl } from '@/lib/site-mode';
import Input from '@/components/ds/Input';
import dynamic from 'next/dynamic';

const HeroBackdrop = dynamic(() => import('@/components/HeroBackdrop'), { ssr: false });

/** Render a headline, highlighting the accent word(s) in gold. */
function Headline({ text, accent }) {
  if (!accent) return <>{text}</>;
  const parts = String(text).split(new RegExp(`(${accent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((p, i) =>
    p.toLowerCase() === accent.toLowerCase()
      ? <span key={i} style={{ color: 'var(--gold-400)' }}>{p}</span>
      : <span key={i}>{p}</span>
  );
}

export default function Home() {
  useStorefrontMotion();
  const router = useRouter();
  const { catalog, add } = useCart();
  const { home, promos } = useSiteContent();

  // Curated via Medusa collections, with graceful fallbacks.
  const featured = (() => {
    const c = catalog.filter((p) => p.collection === 'featured');
    return c.length ? c : catalog.filter((p) => !p.collectible).slice(0, 4);
  })();
  const collectibles = (() => {
    const c = catalog.filter((p) => p.collection === 'collectibles');
    return c.length ? c : catalog.filter((p) => p.collectible);
  })();

  const goShop = () => router.push('/shop');
  const openProduct = (id) => router.push('/product/' + id);
  const handleCta = (url) => {
    if (!url) return;
    if (url.startsWith('#')) document.querySelector(url)?.scrollIntoView({ behavior: 'smooth' });
    else if (url.startsWith('/')) router.push(url);
    else window.location.href = url;
  };

  return (
    <div data-screen-label="Home">
      {/* HERO — full-bleed cinematic waving flag */}
      <section data-band style={{ position: 'relative', overflow: 'hidden', minHeight: 'clamp(560px,78vh,760px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0', background: '#00052e' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundColor: '#00052e', backgroundImage: 'repeating-linear-gradient(to bottom, rgba(193,39,45,0.30) 0 7.69%, rgba(255,255,255,0.05) 7.69% 15.38%)' }} />
        <HeroBackdrop />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'radial-gradient(100% 82% at 50% 50%, rgba(0,5,46,0.72) 0%, rgba(0,5,46,0.45) 45%, rgba(0,5,46,0.22) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 3, width: '100%', maxWidth: 760, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 22 }}>
          <div data-rise><Eyebrow color="onDark" rule>{home.hero_eyebrow}</Eyebrow></div>
          <h1 data-split style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(54px,7vw,88px)', lineHeight: 0.96, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--white)', textShadow: '0 2px 28px rgba(0,0,0,0.5)' }}>
            <Headline text={home.hero_headline} accent={home.hero_accent} />
          </h1>
          <p data-rise style={{ margin: 0, maxWidth: 520, fontSize: 17, lineHeight: 1.7, color: 'var(--text-on-dark-muted)' }}>{home.hero_subcopy}</p>
          <div data-rise style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
            <Button variant="primary" size="lg" arrow onClick={() => handleCta(resolveUrl(home.hero_cta_primary_url, '#services'))}>{home.hero_cta_primary_label}</Button>
            <Button variant="outline" size="lg" onClick={() => handleCta(resolveUrl(home.hero_cta_secondary_url, '#about-band'))} style={{ color: 'var(--white)', border: '1px solid rgba(255,255,255,0.55)', background: 'transparent' }}>{home.hero_cta_secondary_label}</Button>
          </div>
          <div data-rise style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 8, fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)' }}>
            {(home.hero_trust || []).map((t, i) => (
              <span key={i} style={{ display: 'inline-flex', gap: 18 }}>{i > 0 && <span aria-hidden="true">·</span>}<span>{t}</span></span>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT SECTIONS — only on a site with a shop connected.
          A brochure site renders services and contact in their place; it must
          never show an empty product grid or a "See All" button leading to a
          store that does not exist. */}
      {HAS_COMMERCE && (
      <>
      <section data-band style={{ background: 'var(--white)', padding: '80px 0 0' }}>
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px' }}>
          <div data-rise><SectionHeading eyebrow={home.featured?.eyebrow} title={home.featured?.title} subtitle={home.featured?.subtitle} /></div>
          <div data-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 20, marginTop: 32 }}>
            {featured.map((p) => (
              <ProductCard key={p.id} brand={p.brand} title={p.title} image={p.image} price={p.price} compareAt={p.compareAt} badge={p.badge} badgeVariant={p.badgeVariant} onClick={() => openProduct(p.id)} onQuickAdd={() => add(p.id, 1)} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36 }}>
            <Button variant="navy" arrow onClick={goShop}>See All Collection</Button>
          </div>
        </div>
      </section>

      {/* COLLECTIBLES SPOTLIGHT */}
      <section data-band style={{ background: 'var(--white)', padding: '80px 0' }}>
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px' }}>
          <div data-rise><SectionHeading eyebrow={home.collectibles?.eyebrow} title={home.collectibles?.title} subtitle={home.collectibles?.subtitle} /></div>
          <div data-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20, marginTop: 32 }}>
            {collectibles.map((p) => (
              <ProductCard key={p.id} brand={p.brand} title={p.title} image={p.image} price={p.price} compareAt={p.compareAt} badge={p.badge} badgeVariant={p.badgeVariant} onClick={() => openProduct(p.id)} onQuickAdd={() => add(p.id, 1)} />
            ))}
          </div>
        </div>
      </section>

      {/* SHOP BY BRANDS — hides itself when no brands are configured. */}
      <BrandRoster />
      </>
      )}

      {/* BROCHURE SECTIONS — content-driven, shown on every site.
          A store still has services to describe and a phone to answer, so
          these are gated on their CONTENT existing, not on commerce. */}
      <Services services={home.services} />

      {/* PROMO TILES — managed + scheduled */}
      {promos.length > 0 && (
        <section data-band data-parallax-zone style={{ background: 'var(--white)', padding: '80px 0 0' }}>
          <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px,100%),1fr))', gap: 20 }}>
            {promos.map((c, i) => (
              <div data-parallax-img key={i}>
                <PromoCard eyebrow={c.eyebrow} title={c.title} image={c.image_url} overlay={c.overlay || 'navy'} align={c.align || 'left'} height={230} onClick={(e) => { e.preventDefault(); handleCta(resolveUrl(c.link_url, '#contact')); }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOLDS OF HONOR CAUSE BAND */}
      <section id="cause-band" data-band style={{ position: 'relative', background: 'var(--navy-700)', marginTop: 80, overflow: 'hidden' }}>
        <canvas data-fx="stars" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, transition: 'opacity 1.2s ease-out', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 'var(--container)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(360px,100%),1fr))', gap: 48, alignItems: 'center', padding: '80px 24px' }}>
          <div data-rise style={{ position: 'relative', minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ position: 'absolute', top: 16, left: 28, width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-royal)' }} />
            <span style={{ position: 'absolute', bottom: 28, right: 40, width: 26, height: 26, borderRadius: '50%', background: 'var(--brand-red)' }} />
            <div style={{ width: 'min(310px,80%)', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', border: '6px solid var(--white)', boxShadow: 'var(--shadow-lg)' }}>
              <img src={home.cause_image_url} alt={home.cause_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div data-rise><Eyebrow color="onDark">{home.cause_eyebrow}</Eyebrow></div>
            <h2 data-split style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,4.4vw,54px)', lineHeight: 0.98, textTransform: 'uppercase', color: 'var(--white)' }}>{home.cause_title}</h2>
            <p data-rise style={{ margin: 0, maxWidth: 480, fontSize: 16, lineHeight: 1.7, color: 'var(--text-on-dark-muted)' }}>{home.cause_body}</p>
            <div data-rise style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginTop: 10 }}>
              {(home.cause_stats || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span data-count={s.value} style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1, color: 'var(--gold-400)' }}>0</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-on-dark-muted)' }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div data-rise style={{ marginTop: 6 }}>
              <a href={resolveUrl(home.cause_cta_url || '/shop', '#contact')} onClick={(e) => { e.preventDefault(); handleCta(resolveUrl(home.cause_cta_url, '#contact')); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold-400)', textDecoration: 'none', borderBottom: '1px solid var(--gold-600)', paddingBottom: 4 }}>
                {home.cause_cta_label}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT — every field optional; the whole band hides if none are set. */}
      <Contact contact={home.contact} />

      {/* NEWSLETTER */}
      <section data-band style={{ background: 'var(--cream-100)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '72px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div data-rise><Eyebrow color="royal">{home.newsletter_eyebrow}</Eyebrow></div>
          <h2 data-split style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,4vw,46px)', lineHeight: 0.98, textTransform: 'uppercase', color: 'var(--ink)' }}>{home.newsletter_title}</h2>
          <p data-rise style={{ margin: 0, maxWidth: 440, fontSize: 15, lineHeight: 1.7, color: 'var(--text-body)' }}>{home.newsletter_subcopy}</p>
          <div data-rise style={{ display: 'flex', gap: 10, width: 'min(440px,100%)', marginTop: 6 }}>
            <div style={{ flex: '1 1 auto' }}><Input type="email" placeholder="Email address" size="md" /></div>
            <Button variant="navy" arrow>{home.newsletter_button_label}</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
