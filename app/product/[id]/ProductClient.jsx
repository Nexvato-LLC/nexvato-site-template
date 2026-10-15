'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/components/CartProvider';
import { useWishlist } from '@/components/WishlistProvider';
import { useShopConfig } from '@/components/ShopConfigProvider';
import { fetchProductReviews } from '@/lib/shop';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import PriceTag from '@/components/ds/PriceTag';
import Button from '@/components/ds/Button';
import ProductCard from '@/components/ds/ProductCard';
import ReviewsSection, { Stars } from '@/components/ReviewsSection';

// Nothing on the product payload says how many units are in stock (the API
// deliberately does not expose stock counters), so the stepper has a sane
// ceiling instead. If an add is refused because stock is short, the API says how
// many ARE left and the ceiling drops to that (support #228).
const MAX_QTY = 99;

const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function ProductClient({ initial, initialReviews = null }) {
  useStorefrontMotion();
  const { id } = useParams();
  const router = useRouter();
  const { catalog, catalogLoading, add } = useCart();
  const { has: isWished, toggle: toggleWish } = useWishlist();
  const { config } = useShopConfig();

  // Prefer the live catalog once it loads; fall back to the server-rendered product.
  const cur = catalog.find((p) => p.id === id) || initial || {};

  const [qty, setQty] = useState(1);
  const [variantIdx, setVariantIdx] = useState(0);
  const [qtyMax, setQtyMax] = useState(MAX_QTY);
  const [addMsg, setAddMsg] = useState('');
  const [tab, setTab] = useState(0);
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState(initialReviews);
  const [showBar, setShowBar] = useState(false);
  const atcRef = useRef(null);
  const addTimer = useRef(null);

  useEffect(() => () => { if (addTimer.current) clearTimeout(addTimer.current); }, []);

  // The server hands over the first page of reviews; if that fetch failed, try once more here.
  useEffect(() => {
    if (reviews || !cur.productId) return undefined;
    let alive = true;
    fetchProductReviews(cur.productId).then((r) => { if (alive && r) setReviews(r); });
    return () => { alive = false; };
  }, [reviews, cur.productId]);

  useEffect(() => {
    const el = atcRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);

  // Real choices only. A product with a single variant has nothing to choose, so
  // no selector is drawn — the SIGNATURE / FIELD / MIDNIGHT and S/M/L/XL buttons
  // that used to appear on every product did nothing at all (support #213).
  const variants = cur.variants || [];
  const hasChoice = variants.length > 1;
  const variant = variants[hasChoice ? variantIdx : 0] || {};
  const price = hasChoice ? variant.price : cur.price;
  const compareAt = hasChoice ? variant.compareAt : cur.compareAt;
  const inStock = hasChoice ? variant.inStock !== false : cur.inStock !== false;
  const saveAmt = compareAt && compareAt > price ? compareAt - price : 0;
  const savePct = saveAmt ? Math.round((1 - price / compareAt) * 100) : 0;

  // Specifications: only rows that have a value, and no tab at all if none do.
  const specRows = (cur.specs && cur.specs.length ? cur.specs : [['Brand', cur.brand], ['Category', cur.cat]])
    .filter((row) => Array.isArray(row) && row[0] && String(row[1] ?? '').trim());

  // Shipping facts come from the SHOP's own settings, never from copy typed into this
  // file. The old tab promised "30-day returns", a "2-year quality guarantee" and
  // shipping "from Springfield, USA" for every store.
  const shipFacts = [];
  if (config?.freeShippingThreshold) shipFacts.push(`Free U.S. shipping on orders over $${money(config.freeShippingThreshold)}.`);
  if (config?.flatShipping) shipFacts.push(`Standard shipping is $${money(config.flatShipping)}.`);
  if (config?.shipsFrom?.city && config?.shipsFrom?.state) shipFacts.push(`Ships from ${config.shipsFrom.city}, ${config.shipsFrom.state}.`);
  if (config?.supportEmail) shipFacts.push(`Questions about an order? Email ${config.supportEmail}.`);

  const tabs = [
    cur.blurb && { key: 'details', label: 'Details' },
    specRows.length > 0 && { key: 'specs', label: 'Specifications' },
    shipFacts.length > 0 && { key: 'shipping', label: 'Shipping' },
  ].filter(Boolean);
  const activeTab = tabs[Math.min(tab, tabs.length - 1)]?.key;

  const doAdd = async () => {
    setAddMsg('');
    const result = await add(cur.id, qty, hasChoice ? variant.id : cur.variantId);
    if (result?.busy) return;
    if (result && result.ok === false) {
      // Short on stock: lower the stepper to what the API says is left so the
      // shopper can simply press Add again. "Out of stock" only when it is 0.
      if (typeof result.available === 'number' && result.available > 0) {
        setQtyMax(result.available);
        setQty(Math.min(qty, result.available));
        setAddMsg(`Only ${result.available} left in stock — we’ve set your quantity to ${Math.min(qty, result.available)}.`);
      } else if (result.available === 0) {
        setAddMsg('Sorry, this item is out of stock right now.');
      }
      return;
    }
    setQtyMax(MAX_QTY);
    setAdded(true);
    if (addTimer.current) clearTimeout(addTimer.current);
    addTimer.current = setTimeout(() => setAdded(false), 1400);
  };

  const recs = (cur.cat ? catalog.filter((x) => x.id !== cur.id && x.cat === cur.cat) : [])
    .concat(catalog.filter((x) => x.id !== cur.id && (!cur.cat || x.cat !== cur.cat)))
    .slice(0, 4);

  if (!cur.id) {
    return (
      <div data-screen-label="Product" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 13 }}>
        {catalogLoading ? 'Loading…' : 'Product not found.'}
      </div>
    );
  }

  const heart = isWished(cur.productId);
  const stepBtn = { height: 52, background: 'var(--white)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' };

  return (
    <div data-screen-label="Product">
      {/* Breadcrumb */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '14px 24px', fontSize: 13, color: 'var(--text-muted)' }}>
          <a href="/" onClick={(e) => { e.preventDefault(); router.push('/'); }} style={{ color: 'var(--link)', textDecoration: 'none' }}>Home</a>
          <span style={{ padding: '0 6px' }}>/</span>
          <a href="/shop" onClick={(e) => { e.preventDefault(); router.push('/shop'); }} style={{ color: 'var(--link)', textDecoration: 'none' }}>Shop</a>
          {cur.cat && (
            <>
              <span style={{ padding: '0 6px' }}>/</span>
              <a href={'/shop?cat=' + encodeURIComponent(cur.cat)} onClick={(e) => { e.preventDefault(); router.push('/shop?cat=' + encodeURIComponent(cur.cat)); }} style={{ color: 'var(--link)', textDecoration: 'none' }}>{cur.cat}</a>
            </>
          )}
          <span style={{ padding: '0 6px' }}>/</span>
          <span style={{ color: 'var(--text-strong)' }}>{cur.title}</span>
        </div>
      </div>

      {/* Main: media + buy box */}
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(420px,100%),1fr))', gap: 56, padding: '40px 24px 64px', alignItems: 'start' }}>
        {/* MEDIA — rectangular specimen plate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', maxWidth: 560, margin: '0 auto', background: 'var(--cream-50)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            {cur.badge && (
              <span style={{ position: 'absolute', top: 16, left: 16, zIndex: 3 }}>
                <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 'var(--radius-xs)', background: cur.badgeVariant === 'gold' ? 'var(--gold-500)' : cur.badgeVariant === 'navy' ? 'var(--brand-navy)' : cur.badgeVariant === 'royal' ? 'var(--brand-royal)' : 'var(--brand-red)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cur.badge}</span>
              </span>
            )}
            <div
              id="pdp-stage-img"
              role="img"
              aria-label={cur.title}
              style={{ position: 'absolute', inset: '7%', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundImage: `url("${cur.image}")` }}
            />
            {cur.collectible && (
              <canvas data-fx="viewer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, transition: 'opacity 0.5s ease-out', touchAction: 'none' }} />
            )}
          </div>

          {cur.collectible && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /></svg>
              Drag to rotate · 360° view
            </span>
          )}
        </div>

        {/* BUY BOX (sticky) */}
        <div style={{ position: 'sticky', top: 100, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cur.brand && <Eyebrow color="royal">{cur.brand}</Eyebrow>}
            <h1 data-split style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 'clamp(28px,3.4vw,40px)', lineHeight: 1.08, letterSpacing: '-0.005em', color: 'var(--ink)', overflowWrap: 'anywhere' }}>{cur.title}</h1>
            {/* Only when there ARE reviews. "0.0 (0 reviews)" next to empty stars is noise,
                and a rating with no reviews behind it is a lie (support #213). */}
            {reviews && reviews.total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Stars value={reviews.average || 0} size={17} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{(reviews.average || 0).toFixed(1)}</span>
                <a href="#reviews" onClick={(e) => { e.preventDefault(); document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ fontSize: 13, color: 'var(--link)', textDecoration: 'none' }}>
                  ({reviews.total} {reviews.total === 1 ? 'review' : 'reviews'})
                </a>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '18px 0', paddingTop: 18, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <PriceTag price={price || 0} compareAt={compareAt} size="lg" />
            {saveAmt > 0 && (
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--price-sale)' }}>Save ${saveAmt.toFixed(0)} (−{savePct}%)</span>
            )}
          </div>

          {cur.blurb && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)', maxWidth: '52ch', overflowWrap: 'anywhere' }}>{cur.blurb}</p>}

          {hasChoice && (
            <fieldset style={{ border: 'none', padding: 0, margin: '20px 0 0', minWidth: 0 }}>
              <legend style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-strong)', padding: 0, marginBottom: 8 }}>Option</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {variants.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setVariantIdx(i); setAddMsg(''); }}
                    aria-pressed={variantIdx === i}
                    disabled={v.inStock === false}
                    title={v.inStock === false ? 'Out of stock' : undefined}
                    style={{ minWidth: 48, minHeight: 44, padding: '0 16px', cursor: v.inStock === false ? 'not-allowed' : 'pointer', borderRadius: 'var(--radius-md)', background: variantIdx === i ? 'var(--brand-navy)' : 'var(--white)', color: variantIdx === i ? '#fff' : 'var(--text-strong)', border: `1px solid ${variantIdx === i ? 'var(--brand-navy)' : 'var(--border-strong)'}`, opacity: v.inStock === false ? 0.45 : 1, textDecoration: v.inStock === false ? 'line-through' : 'none', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}
                  >{v.name || `Option ${i + 1}`}</button>
                ))}
              </div>
            </fieldset>
          )}

          <div ref={atcRef} style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity" className="site-qtybtn" style={{ ...stepBtn, width: 44, opacity: qty <= 1 ? 0.4 : 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
              </button>
              <span style={{ width: 46, textAlign: 'center', fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(qtyMax, q + 1))} disabled={qty >= qtyMax} aria-label="Increase quantity" title={qty >= qtyMax ? `Maximum ${qtyMax}` : undefined} className="site-qtybtn" style={{ ...stepBtn, width: 44, opacity: qty >= qtyMax ? 0.4 : 1, cursor: qty >= qtyMax ? 'not-allowed' : 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <span style={{ flex: '1 1 200px', minWidth: 0 }}>
              <Button variant={added ? 'navy' : 'primary'} size="lg" fullWidth arrow={!added && inStock} disabled={!inStock} onClick={doAdd}>{!inStock ? 'Out of Stock' : added ? 'Added ✓' : 'Add to Cart'}</Button>
            </span>
            <button onClick={() => toggleWish(cur.productId)} aria-label={heart ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={heart} style={{ width: 52, height: 52, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'var(--white)', border: '1px solid var(--border-strong)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={heart ? 'var(--brand-red)' : 'none'} stroke={heart ? 'var(--brand-red)' : 'var(--text-strong)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            </button>
          </div>
          {addMsg && <p role="alert" style={{ margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--danger)' }}>{addMsg}</p>}

          {/* trust strip — only what the shop's own settings say */}
          {config?.freeShippingThreshold ? (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-body)' }}>
                <span style={{ color: 'var(--brand-royal)', display: 'inline-flex' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7z" /></svg>
                </span>
                Free U.S. shipping over ${money(config.freeShippingThreshold)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tabs — only the ones with something real to say */}
      {tabs.length > 0 && (
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px 56px' }}>
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {tabs.map((t, i) => (
              <button key={t.key} onClick={() => setTab(i)} aria-selected={activeTab === t.key} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 6px', marginBottom: -1, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: activeTab === t.key ? 'var(--ink)' : 'var(--text-muted)', borderBottom: `2px solid ${activeTab === t.key ? 'var(--brand-royal)' : 'transparent'}` }}>{t.label}</button>
            ))}
          </div>
          <div style={{ padding: '24px 0', maxWidth: 720 }}>
            {activeTab === 'details' && (
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.8, color: 'var(--text-body)', overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{cur.blurb}</p>
            )}
            {activeTab === 'specs' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
                {specRows.map(([label, value]) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,160px) minmax(0,1fr)', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ color: 'var(--text-body)', overflowWrap: 'anywhere' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'shipping' && (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.9, color: 'var(--text-body)' }}>
                {shipFacts.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Reviews — real ones only */}
      <ReviewsSection key={reviews ? 'loaded' : 'pending'} productId={cur.productId} reviews={reviews} />

      {/* Recommendations */}
      {recs.length > 0 && (
        <section data-band style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px 80px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink)', margin: '0 0 20px' }}>{cur.cat ? `More ${cur.cat}` : 'You may also like'}</h2>
          <div data-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(250px,100%),1fr))', gap: 20 }}>
            {recs.map((r) => (
              <ProductCard key={r.id} brand={r.brand} title={r.title} image={r.image} price={r.price} compareAt={r.compareAt} badge={r.badge} badgeVariant={r.badgeVariant} wishlisted={isWished(r.productId)} onWishlist={() => toggleWish(r.productId)} onClick={() => router.push('/product/' + r.id)} onQuickAdd={() => add(r.id, 1)} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile sticky add-to-cart bar (hidden on desktop via .pdp-atc-bar) */}
      <div className="pdp-atc-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, transform: showBar ? 'translateY(0)' : 'translateY(110%)', transition: 'transform var(--dur-normal) var(--ease-out)', background: 'var(--white)', borderTop: '1px solid var(--border)', boxShadow: '0 -6px 20px rgba(16,35,61,0.12)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title}</div>
            <PriceTag price={price || 0} compareAt={compareAt} size="sm" />
          </div>
          <span style={{ flex: '0 0 auto' }}>
            <Button variant="primary" arrow={inStock} disabled={!inStock} onClick={doAdd}>{inStock ? 'Add to Cart' : 'Sold Out'}</Button>
          </span>
        </div>
      </div>
    </div>
  );
}
