'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/components/CartProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import PriceTag from '@/components/ds/PriceTag';
import Button from '@/components/ds/Button';
import ProductCard from '@/components/ds/ProductCard';

/**
 * Product page.
 *
 * Shows the merchant's REAL product (support #133): saved photos, the actual
 * active variants with their own prices and stock, and the saved description.
 * Removed because none of it came from the merchant: sample reviews and star
 * ratings, invented "finishes" and S–XL sizes with a size guide, a 360° viewer
 * of placeholder art, and promises the store never made (free shipping over
 * $75, Springfield dispatch, 30-day returns, 2-year guarantee, "trusted
 * seller"). Shipping costs are shown by the cart and checkout, from the
 * store's own settings.
 */
export default function ProductClient({ initial }) {
  useStorefrontMotion();
  const { id } = useParams();
  const router = useRouter();
  const { catalog, catalogLoading, add } = useCart();

  // Prefer the live catalog once it loads; fall back to the server-rendered product.
  const cur = catalog.find((p) => p.id === id) || initial || {};
  const variants = cur.variants || [];

  const [variantId, setVariantId] = useState(cur.variantId || null);
  const [photo, setPhoto] = useState(0);
  // A picked thumbnail wins over the selected variant's own photo until
  // another variant is picked.
  const [preferPhoto, setPreferPhoto] = useState(false);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState(0);
  const [added, setAdded] = useState(false);
  const [wished, setWished] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const atcRef = useRef(null);
  const addTimer = useRef(null);

  useEffect(() => {
    setQty(1); setTab(0); setPhoto(0); setPreferPhoto(false);
    return () => { if (addTimer.current) clearTimeout(addTimer.current); };
  }, [id]);
  // Default to the first buyable variant once the product is known.
  useEffect(() => {
    if (!variants.some((v) => v.id === variantId)) setVariantId(cur.variantId || null);
  }, [cur.variantId, variants, variantId]);

  useEffect(() => {
    const el = atcRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);

  const selected = variants.find((v) => v.id === variantId) || null;
  const price = selected ? selected.price : cur.price || 0;
  const compareAt = selected ? selected.compareAt : cur.compareAt;
  const soldOut = selected ? !selected.inStock : cur.inStock === false;
  const saveAmt = compareAt && compareAt > price ? compareAt - price : 0;
  const savePct = saveAmt ? Math.round((1 - price / compareAt) * 100) : 0;
  const photos = cur.photos || [];
  const variantPhoto = !preferPhoto && selected?.imageUrl;
  const mainImage = variantPhoto || photos[photo] || cur.image;
  const hasPhoto = Boolean(variantPhoto || photos.length);
  const specs = (cur.specs && cur.specs.length ? cur.specs : [['Brand', cur.brand], ['Category', cur.cat]])
    .filter(([, value]) => value);
  const tabs = [cur.blurb && 'Details', specs.length > 0 && 'Specifications'].filter(Boolean);

  const doAdd = async () => {
    if (soldOut) return;
    // "Added ✓" only once the server has the item. A refusal (sold out, not
    // enough stock) is explained in the cart drawer instead (support #142).
    if (!(await add(cur.id, qty, selected?.id))) return;
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

  const addLabel = soldOut ? 'Sold out' : added ? 'Added ✓' : 'Add to Cart';

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
        {/* MEDIA — the saved photos, or a labelled placeholder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', maxWidth: 560, margin: '0 auto', background: 'var(--cream-50)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            {cur.badge && (
              <span style={{ position: 'absolute', top: 16, left: 16, zIndex: 3 }}>
                <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 'var(--radius-xs)', background: cur.badgeVariant === 'gold' ? 'var(--gold-500)' : cur.badgeVariant === 'navy' ? 'var(--brand-navy)' : cur.badgeVariant === 'royal' ? 'var(--brand-royal)' : 'var(--brand-red)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cur.badge}</span>
              </span>
            )}
            <img
              id="pdp-stage-img"
              src={mainImage}
              alt={hasPhoto ? cur.title : `${cur.title}: photo coming soon`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: hasPhoto ? 'contain' : 'cover', display: 'block' }}
            />
          </div>
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {photos.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => { setPhoto(i); setPreferPhoto(true); }}
                  aria-label={`Show photo ${i + 1} of ${photos.length}`}
                  aria-pressed={!variantPhoto && photo === i}
                  style={{ width: 64, height: 64, padding: 0, cursor: 'pointer', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--white)', border: `2px solid ${!variantPhoto && photo === i ? 'var(--brand-navy)' : 'var(--border-strong)'}` }}
                >
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* BUY BOX (sticky) */}
        <div style={{ position: 'sticky', top: 100, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cur.brand && <Eyebrow color="royal">{cur.brand}</Eyebrow>}
            <h1 data-split style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 'clamp(28px,3.4vw,40px)', lineHeight: 1.08, letterSpacing: '-0.005em', color: 'var(--ink)', overflowWrap: 'anywhere' }}>{cur.title}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '18px 0', paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <PriceTag price={price} compareAt={compareAt} size="lg" />
            {saveAmt > 0 && (
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--price-sale)' }}>Save ${saveAmt.toFixed(2)} (−{savePct}%)</span>
            )}
          </div>

          {cur.blurb && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)', maxWidth: '52ch', whiteSpace: 'pre-line' }}>{cur.blurb}</p>}

          {/* The product's own variants — only when there is a real choice. */}
          {variants.length > 1 && (
            <fieldset style={{ border: 'none', padding: 0, margin: '20px 0 0' }}>
              <legend style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-strong)', padding: 0, marginBottom: 8 }}>Options</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {variants.map((v) => {
                  const on = v.id === variantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { setVariantId(v.id); setPreferPhoto(false); }}
                      aria-pressed={on}
                      style={{ minHeight: 44, padding: '8px 14px', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: on ? 'var(--brand-navy)' : 'var(--white)', color: on ? '#fff' : v.inStock ? 'var(--text-strong)' : 'var(--text-muted)', border: `1px solid ${on ? 'var(--brand-navy)' : 'var(--border-strong)'}`, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13, textDecoration: v.inStock ? 'none' : 'line-through' }}
                    >
                      {v.name}{v.inStock ? '' : ' (sold out)'}
                    </button>
                  );
                })}
              </div>
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
              <Button variant={added ? 'navy' : 'primary'} size="lg" fullWidth arrow={!added && !soldOut} disabled={soldOut} onClick={doAdd}>{addLabel}</Button>
            </span>
            <button onClick={() => setWished((v) => !v)} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wished} style={{ width: 52, height: 52, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'var(--white)', border: '1px solid var(--border-strong)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={wished ? 'var(--brand-red)' : 'none'} stroke={wished ? 'var(--brand-red)' : 'var(--text-strong)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs: only what the merchant actually saved */}
      {tabs.length > 0 && (
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px 56px' }}>
        <div role="tablist" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {tabs.map((t, i) => (
            <button key={t} role="tab" onClick={() => setTab(i)} aria-selected={tab === i} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 6px', marginBottom: -1, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: tab === i ? 'var(--ink)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === i ? 'var(--brand-royal)' : 'transparent'}` }}>{t}</button>
          ))}
        </div>
        <div style={{ padding: '24px 0', maxWidth: 720 }}>
          {tabs[tab] === 'Details' && (
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.8, color: 'var(--text-body)', whiteSpace: 'pre-line' }}>{cur.blurb}</p>
          )}
          {tabs[tab] === 'Specifications' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
              {specs.map(([label, value]) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,160px) 1fr', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-body)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
      <section data-band style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink)', margin: '0 0 20px' }}>{cur.cat ? `More ${cur.cat}` : 'More products'}</h2>
        <div data-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(250px,100%),1fr))', gap: 20 }}>
          {recs.map((r) => (
            <ProductCard key={r.id} brand={r.brand} title={r.title} image={r.image} price={r.price} compareAt={r.compareAt} badge={r.badge} badgeVariant={r.badgeVariant} onClick={() => router.push('/product/' + r.id)} onQuickAdd={() => add(r.id, 1)} />
          ))}
        </div>
      </section>
      )}

      {/* Mobile sticky add-to-cart bar (hidden on desktop via .pdp-atc-bar) */}
      <div className="pdp-atc-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, transform: showBar ? 'translateY(0)' : 'translateY(110%)', transition: 'transform var(--dur-normal) var(--ease-out)', background: 'var(--white)', borderTop: '1px solid var(--border)', boxShadow: '0 -6px 20px rgba(16,35,61,0.12)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 'var(--container)', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title}{selected && variants.length > 1 ? ` · ${selected.name}` : ''}</div>
            <PriceTag price={price} compareAt={compareAt} size="sm" />
          </div>
          <span style={{ flex: '0 0 auto' }}>
            <Button variant="primary" arrow={!soldOut} disabled={soldOut} onClick={doAdd}>{soldOut ? 'Sold out' : 'Add to Cart'}</Button>
          </span>
        </div>
      </div>
    </div>
  );
}
