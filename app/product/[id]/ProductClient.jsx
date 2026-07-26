'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { productArt } from '@/lib/data';
import { useCart } from '@/components/CartProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import PriceTag from '@/components/ds/PriceTag';
import Button from '@/components/ds/Button';
import ProductCard from '@/components/ds/ProductCard';
import ReviewsSection, { Stars } from '@/components/ReviewsSection';

const FINISHES = [
  { label: 'Signature', tone: null },
  { label: 'Field', tone: '#17324f' },
  { label: 'Midnight', tone: '#0f1c30' },
];
const SIZE_GUIDE = [
  ['S', 'Chest 34–36"'],
  ['M', 'Chest 38–40"'],
  ['L', 'Chest 42–44"'],
  ['XL', 'Chest 46–48"'],
];
const TABS = ['Details', 'Specifications', 'Shipping & Returns'];

export default function ProductClient({ initial }) {
  useStorefrontMotion();
  const { id } = useParams();
  const router = useRouter();
  const { catalog, catalogLoading, add } = useCart();

  // Prefer the live catalog once it loads; fall back to the server-rendered product.
  const cur = catalog.find((p) => p.id === id) || initial || {};

  const [finish, setFinish] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [tab, setTab] = useState(0);
  const [added, setAdded] = useState(false);
  const [wished, setWished] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const stageRef = useRef(null);
  const atcRef = useRef(null);
  const addTimer = useRef(null);

  useEffect(() => {
    setFinish(0); setQty(1); setSelectedSize(null); setTab(0);
    return () => { if (addTimer.current) clearTimeout(addTimer.current); };
  }, [id]);

  const stageTone = FINISHES[finish].tone || cur.tone;
  const stageImage = productArt({ ...cur, tone: stageTone });

  useEffect(() => {
    const el = stageRef.current;
    if (el && window.gsap && window.SiteMotion && !window.SiteMotion.reduced()) {
      window.gsap.fromTo(el, { opacity: 0.2 }, { opacity: 1, duration: 0.32, ease: 'power2.out' });
    }
  }, [finish]);

  useEffect(() => {
    const el = atcRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);

  const hasSizes = cur.cat === 'Apparel' || cur.cat === 'Headwear';
  const saveAmt = cur.compareAt && cur.compareAt > cur.price ? cur.compareAt - cur.price : 0;
  const savePct = saveAmt ? Math.round((1 - cur.price / cur.compareAt) * 100) : 0;
  const specs = cur.specs && cur.specs.length ? cur.specs : [['Brand', cur.brand], ['Category', cur.cat]];

  const doAdd = () => {
    add(cur.id, qty);
    setAdded(true);
    if (addTimer.current) clearTimeout(addTimer.current);
    addTimer.current = setTimeout(() => setAdded(false), 1400);
  };

  const recs = catalog.filter((x) => x.id !== cur.id && x.cat === cur.cat)
    .concat(catalog.filter((x) => x.id !== cur.id && x.cat !== cur.cat))
    .slice(0, 4);

  if (!cur.id) {
    return (
      <div data-screen-label="Product" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 13 }}>
        {catalogLoading ? 'Loading…' : 'Product not found.'}
      </div>
    );
  }

  return (
    <div data-screen-label="Product">
      {/* Breadcrumb */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '14px 24px', fontSize: 13, color: 'var(--text-muted)' }}>
          <a href="/" onClick={(e) => { e.preventDefault(); router.push('/'); }} style={{ color: 'var(--link)', textDecoration: 'none' }}>Home</a>
          <span style={{ padding: '0 6px' }}>/</span>
          <a href="/shop" onClick={(e) => { e.preventDefault(); router.push('/shop'); }} style={{ color: 'var(--link)', textDecoration: 'none' }}>Shop</a>
          <span style={{ padding: '0 6px' }}>/</span>
          <a href={'/shop?cat=' + encodeURIComponent(cur.cat || '')} onClick={(e) => { e.preventDefault(); router.push('/shop?cat=' + encodeURIComponent(cur.cat || '')); }} style={{ color: 'var(--link)', textDecoration: 'none' }}>{cur.cat}</a>
          <span style={{ padding: '0 6px' }}>/</span>
          <span style={{ color: 'var(--text-strong)' }}>{cur.title}</span>
        </div>
      </div>

      {/* Main: media + buy box */}
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(420px,100%),1fr))', gap: 56, padding: '40px 24px 64px', alignItems: 'start' }}>
        {/* MEDIA — rectangular specimen plate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', maxWidth: 560, margin: '0 auto', background: 'var(--cream-50)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            {cur.badge && (
              <span style={{ position: 'absolute', top: 16, left: 16, zIndex: 3 }}>
                <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 'var(--radius-xs)', background: cur.badgeVariant === 'gold' ? 'var(--gold-500)' : cur.badgeVariant === 'navy' ? 'var(--brand-navy)' : cur.badgeVariant === 'royal' ? 'var(--brand-royal)' : 'var(--brand-red)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cur.badge}</span>
              </span>
            )}
            <div
              id="pdp-stage-img"
              ref={stageRef}
              role="img"
              aria-label={cur.title}
              style={{ position: 'absolute', inset: '7%', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundImage: `url("${stageImage}")` }}
            />
            {cur.collectible && (
              <canvas data-fx="viewer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, transition: 'opacity 0.5s ease-out', touchAction: 'none' }} />
            )}
          </div>

          {/* caption / finish chips */}
          {cur.collectible ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /></svg>
              Drag to rotate · 360° view
            </span>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {FINISHES.map((f, i) => (
                <button
                  key={f.label}
                  onClick={() => setFinish(i)}
                  aria-pressed={finish === i}
                  style={{ padding: '7px 14px', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: finish === i ? 'var(--brand-navy)' : 'var(--white)', color: finish === i ? '#fff' : 'var(--text-body)', border: `1px solid ${finish === i ? 'var(--brand-navy)' : 'var(--border-strong)'}`, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* BUY BOX (sticky) */}
        <div style={{ position: 'sticky', top: 100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Eyebrow color="royal">{cur.brand}</Eyebrow>
            <h1 data-split style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 'clamp(28px,3.4vw,40px)', lineHeight: 1.08, letterSpacing: '-0.005em', color: 'var(--ink)' }}>{cur.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Stars value={cur.rating || 0} size={17} />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{(cur.rating || 0).toFixed(1)}</span>
              <a href="#reviews" onClick={(e) => { e.preventDefault(); document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ fontSize: 13, color: 'var(--link)', textDecoration: 'none' }}>
                (<span data-count={cur.reviews || 0}>0</span> reviews)
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '18px 0', paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <PriceTag price={cur.price || 0} compareAt={cur.compareAt} size="lg" />
            {saveAmt > 0 && (
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--price-sale)' }}>Save ${saveAmt.toFixed(0)} (−{savePct}%)</span>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)', maxWidth: '52ch' }}>{cur.blurb || cur.title}</p>

          {hasSizes && (
            <fieldset style={{ border: 'none', padding: 0, margin: '20px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <legend style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-strong)', padding: 0 }}>Size</legend>
                <button type="button" onClick={() => setShowGuide((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--link)', textDecoration: 'underline' }}>Size guide</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['S', 'M', 'L', 'XL'].map((sz) => (
                  <button key={sz} onClick={() => setSelectedSize(sz)} aria-pressed={selectedSize === sz} style={{ width: 48, height: 44, cursor: 'pointer', borderRadius: 'var(--radius-md)', background: selectedSize === sz ? 'var(--brand-navy)' : 'var(--white)', color: selectedSize === sz ? '#fff' : 'var(--text-strong)', border: `1px solid ${selectedSize === sz ? 'var(--brand-navy)' : 'var(--border-strong)'}`, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)' }}>{sz}</button>
                ))}
              </div>
              {showGuide && (
                <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {SIZE_GUIDE.map(([sz, m], i) => (
                    <div key={sz} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', fontSize: 13, color: 'var(--text-body)', background: i % 2 ? 'var(--gray-100)' : 'var(--white)' }}>
                      <span style={{ fontWeight: 700 }}>{sz}</span><span>{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          <div ref={atcRef} style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className="site-qtybtn" style={{ width: 44, height: 52, background: 'var(--white)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
              </button>
              <span style={{ width: 46, textAlign: 'center', fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity" className="site-qtybtn" style={{ width: 44, height: 52, background: 'var(--white)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <span style={{ flex: '1 1 200px' }}>
              <Button variant={added ? 'navy' : 'primary'} size="lg" fullWidth arrow={!added} onClick={doAdd}>{added ? 'Added ✓' : 'Add to Cart'}</Button>
            </span>
            <button onClick={() => setWished((v) => !v)} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wished} style={{ width: 52, height: 52, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'var(--white)', border: '1px solid var(--border-strong)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={wished ? 'var(--brand-red)' : 'none'} stroke={wished ? 'var(--brand-red)' : 'var(--text-strong)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            </button>
          </div>

          {/* trust strip */}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {[
              ['M2 6h11v10H2zM13 9h4l3 3v4h-7z', 'Free U.S. shipping over $75'],
              ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z', '2-year quality guarantee'],
              ['M12 2 14.9 8.3 21.8 9l-5.1 4.7 1.4 6.8L12 17.8 6 20.5l1.4-6.8L2.3 9l6.9-.7Z', 'Trusted seller'],
            ].map(([d, label]) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-body)' }}>
                <span style={{ color: 'var(--brand-royal)', display: 'inline-flex' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs: Details / Specifications / Shipping */}
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px 56px' }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} aria-selected={tab === i} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 6px', marginBottom: -1, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: tab === i ? 'var(--ink)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === i ? 'var(--brand-royal)' : 'transparent'}` }}>{t}</button>
          ))}
        </div>
        <div style={{ padding: '24px 0', maxWidth: 720 }}>
          {tab === 0 && (
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.8, color: 'var(--text-body)' }}>
              {cur.blurb} {cur.collectible ? 'Each piece is individually inspected.' : 'Backed by our quality guarantee.'}
            </p>
          )}
          {tab === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
              {specs.map(([label, value], i) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-body)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 2 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.9, color: 'var(--text-body)' }}>
              <li>Free U.S. shipping on orders over $75.</li>
              <li>Ships in 1–2 business days from Springfield, USA.</li>
              <li>30-day returns on unused gear in original condition.</li>
              <li>Backed by a 2-year quality guarantee.</li>
            </ul>
          )}
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection product={cur} />

      {/* Recommendations */}
      <section data-band style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink)', margin: '0 0 20px' }}>More {cur.cat}</h2>
        <div data-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 20 }}>
          {recs.map((r) => (
            <ProductCard key={r.id} brand={r.brand} title={r.title} image={r.image} price={r.price} compareAt={r.compareAt} badge={r.badge} badgeVariant={r.badgeVariant} onClick={() => router.push('/product/' + r.id)} onQuickAdd={() => add(r.id, 1)} />
          ))}
        </div>
      </section>

      {/* Mobile sticky add-to-cart bar (hidden on desktop via .pdp-atc-bar) */}
      <div className="pdp-atc-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, transform: showBar ? 'translateY(0)' : 'translateY(110%)', transition: 'transform var(--dur-normal) var(--ease-out)', background: 'var(--white)', borderTop: '1px solid var(--border)', boxShadow: '0 -6px 20px rgba(16,35,61,0.12)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title}</div>
            <PriceTag price={cur.price || 0} compareAt={cur.compareAt} size="sm" />
          </div>
          <span style={{ flex: '0 0 auto' }}>
            <Button variant="primary" arrow onClick={doAdd}>Add to Cart</Button>
          </span>
        </div>
      </div>
    </div>
  );
}
