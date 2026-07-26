'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { JAYS_DATA } from '@/lib/data';
import { useCart } from '@/components/CartProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import ProductCard from '@/components/ds/ProductCard';
import PriceTag from '@/components/ds/PriceTag';

const useIsoLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const PRICE_BUCKETS = [
  { key: 'any', label: 'Any price', test: () => true },
  { key: 'u25', label: 'Under $25', test: (p) => p.price < 25 },
  { key: '25-50', label: '$25 – $50', test: (p) => p.price >= 25 && p.price < 50 },
  { key: '50-100', label: '$50 – $100', test: (p) => p.price >= 50 && p.price < 100 },
  { key: '100', label: '$100 & up', test: (p) => p.price >= 100 },
];
const RATINGS = [
  { key: 0, label: 'Any rating' },
  { key: 4, label: '4.0 & up' },
  { key: 4.5, label: '4.5 & up' },
];
const SORTS = [
  { key: 'featured', label: 'Featured' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'rated', label: 'Top Rated' },
];

export default function ShopClient({ initialCat = null, initialBrand = null, initialQ = '' }) {
  useStorefrontMotion();
  const router = useRouter();
  const { catalog, catalogLoading, add } = useCart();

  const [filterCat, setFilterCat] = useState(initialCat);
  const [filterBrand, setFilterBrand] = useState(initialBrand);
  const [searchQ, setSearchQ] = useState(initialQ);
  const [priceKey, setPriceKey] = useState('any');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('featured');
  const [view, setView] = useState('grid');
  const [visible, setVisible] = useState(9);
  const [sortOpen, setSortOpen] = useState(false);

  const gridRef = useRef(null);
  const flipRef = useRef(null);
  const sortRef = useRef(null);
  const firstUrl = useRef(true);

  // --- predicates ---
  const bucket = PRICE_BUCKETS.find((b) => b.key === priceKey) || PRICE_BUCKETS[0];
  const passSearch = (p) => !searchQ || (p.title + ' ' + p.brand + ' ' + p.cat).toLowerCase().includes(searchQ.toLowerCase());
  const passPrice = (p) => bucket.test(p);
  const passRating = (p) => (p.rating || 0) >= minRating;

  // --- final list ---
  const items = useMemo(() => {
    let list = catalog.filter(
      (p) =>
        passSearch(p) &&
        passPrice(p) &&
        passRating(p) &&
        (!filterCat || p.cat === filterCat) &&
        (!filterBrand || p.brand === filterBrand)
    );
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === 'rated') list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, searchQ, priceKey, minRating, filterCat, filterBrand, sort]);
  const shown = items.slice(0, visible);

  // --- contextual facet counts (apply every OTHER facet) ---
  const catCounts = useMemo(() => {
    const m = {};
    JAYS_DATA.categories.forEach((c) => {
      m[c] = catalog.filter((p) => passSearch(p) && passPrice(p) && passRating(p) && (!filterBrand || p.brand === filterBrand) && p.cat === c).length;
    });
    m.__all = catalog.filter((p) => passSearch(p) && passPrice(p) && passRating(p) && (!filterBrand || p.brand === filterBrand)).length;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, searchQ, priceKey, minRating, filterBrand]);
  const brandCounts = useMemo(() => {
    const m = {};
    JAYS_DATA.brands.forEach((b) => {
      m[b] = catalog.filter((p) => passSearch(p) && passPrice(p) && passRating(p) && (!filterCat || p.cat === filterCat) && p.brand === b).length;
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, searchQ, priceKey, minRating, filterCat]);

  // --- GSAP Flip: capture before a discrete change, animate after render ---
  const reduced = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.__JAYS_FORCE_REDUCED === true);

  useEffect(() => {
    if (window.gsap && window.Flip) window.gsap.registerPlugin(window.Flip);
  }, []);

  const captureFlip = () => {
    if (view !== 'grid' || reduced() || !window.Flip || !gridRef.current) return;
    flipRef.current = window.Flip.getState(gridRef.current.querySelectorAll('[data-flip]'));
  };
  const withFlip = (fn) => () => { captureFlip(); fn(); };

  useIsoLayout(() => {
    if (!flipRef.current || !window.Flip) return;
    window.Flip.from(flipRef.current, {
      duration: 0.5,
      ease: 'power3.inOut',
      scale: true,
      absolute: true,
      stagger: 0.02,
      onEnter: (els) => window.gsap && window.gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.35 }),
      onLeave: (els) => window.gsap && window.gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.25 }),
    });
    flipRef.current = null;
  }, [filterCat, filterBrand, priceKey, minRating, sort, visible]);

  // --- URL sync (cat/brand/q — what the server seeds from) ---
  useEffect(() => {
    if (firstUrl.current) { firstUrl.current = false; return; }
    const qs = new URLSearchParams();
    if (filterCat) qs.set('cat', filterCat);
    if (filterBrand) qs.set('brand', filterBrand);
    if (searchQ) qs.set('q', searchQ);
    const str = qs.toString();
    router.replace(str ? `/shop?${str}` : '/shop', { scroll: false });
  }, [filterCat, filterBrand, searchQ, router]);

  // --- close the sort popover on outside click / escape ---
  useEffect(() => {
    if (!sortOpen) return undefined;
    const onDoc = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setSortOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [sortOpen]);

  const setCat = (c) => withFlip(() => { setFilterCat((v) => (v === c ? null : c)); setVisible(9); });
  const setBrand = (b) => withFlip(() => { setFilterBrand((v) => (v === b ? null : b)); setVisible(9); });
  const setPrice = (k) => withFlip(() => { setPriceKey(k); setVisible(9); });
  const setRating = (r) => withFlip(() => { setMinRating(r); setVisible(9); });
  const pickSort = (k) => { captureFlip(); setSort(k); setSortOpen(false); };
  const clearAll = withFlip(() => { setFilterCat(null); setFilterBrand(null); setSearchQ(''); setPriceKey('any'); setMinRating(0); setVisible(9); });

  const activeChips = [];
  if (filterCat) activeChips.push({ label: filterCat, onRemove: setCat(filterCat) });
  if (filterBrand) activeChips.push({ label: filterBrand, onRemove: setBrand(filterBrand) });
  if (priceKey !== 'any') activeChips.push({ label: bucket.label, onRemove: setPrice('any') });
  if (minRating) activeChips.push({ label: `${minRating}★ & up`, onRemove: setRating(0) });
  if (searchQ) activeChips.push({ label: `“${searchQ}”`, onRemove: () => setSearchQ('') });

  const sortLabel = (SORTS.find((s) => s.key === sort) || SORTS[0]).label;

  return (
    <div data-screen-label="Collection">
      {/* HERO band with WebGL dot field */}
      <div data-band style={{ position: 'relative', overflow: 'hidden', background: 'var(--navy-700)', color: 'var(--white)' }}>
        <canvas data-fx="dots" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, transition: 'opacity 0.6s ease-out', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 'var(--container)', margin: '0 auto', padding: '52px 24px' }}>
          <div data-rise><Eyebrow color="onDark" rule>Shop</Eyebrow></div>
          <h1 data-split style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,5vw,58px)', textTransform: 'uppercase', lineHeight: 0.98, color: 'var(--white)' }}>
            The Collection
          </h1>
          <p data-rise style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--text-on-dark-muted)' }}>
            <a href="/" onClick={(e) => { e.preventDefault(); router.push('/'); }} style={{ color: 'var(--gold-400)', textDecoration: 'none' }}>Home</a>
            <span style={{ padding: '0 8px' }}>/</span>Collection
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 36, padding: '36px 24px 80px', alignItems: 'flex-start' }}>
        {/* FILTER RAIL */}
        <aside className="shop-rail" style={{ flex: '0 1 250px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 120 }}>
          <SearchBox value={searchQ} onChange={setSearchQ} />
          <FacetGroup title="Category">
            <FacetRow label="All Products" count={catCounts.__all} on={!filterCat} onClick={setCat(filterCat)} disabledClick={!filterCat} forceOn={!filterCat} allRow />
            {JAYS_DATA.categories.map((c) => (
              <FacetRow key={c} label={c} count={catCounts[c]} on={filterCat === c} onClick={setCat(c)} />
            ))}
          </FacetGroup>
          <FacetGroup title="Brand">
            {JAYS_DATA.brands.map((b) => (
              <FacetRow key={b} label={b} count={brandCounts[b]} on={filterBrand === b} onClick={setBrand(b)} />
            ))}
          </FacetGroup>
          <FacetGroup title="Price">
            {PRICE_BUCKETS.map((b) => (
              <FacetRow key={b.key} label={b.label} on={priceKey === b.key} onClick={setPrice(b.key)} radio />
            ))}
          </FacetGroup>
          <FacetGroup title="Rating">
            {RATINGS.map((r) => (
              <FacetRow key={r.key} label={r.label} on={minRating === r.key} onClick={setRating(r.key)} radio />
            ))}
          </FacetGroup>
        </aside>

        {/* GRID COLUMN */}
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-strong)' }}>{shown.length}</strong> of {items.length} products
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ViewToggle view={view} setView={setView} />
              {/* Custom sort dropdown */}
              <div ref={sortRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setSortOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  data-cursor="sort"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: 'var(--text-strong)', background: 'var(--white)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '9px 12px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>Sort:</span> {sortLabel}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast)' }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {sortOpen && (
                  <ul role="listbox" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, listStyle: 'none', margin: 0, padding: 6, minWidth: 210, background: 'var(--white)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}>
                    {SORTS.map((s) => (
                      <li key={s.key} role="option" aria-selected={sort === s.key}>
                        <button type="button" onClick={() => pickSort(s.key)} style={{
                          width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', borderRadius: 3, padding: '9px 10px',
                          background: sort === s.key ? 'var(--royal-100)' : 'transparent', color: sort === s.key ? 'var(--royal-700)' : 'var(--text-body)',
                          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: sort === s.key ? 700 : 400,
                        }}>{s.label}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 18px' }}>
              {activeChips.map((c) => (
                <button key={c.label} onClick={c.onRemove} data-cursor="remove" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--royal-100)', color: 'var(--royal-700)', border: '1px solid var(--royal-500)', borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer',
                  fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {c.label}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              ))}
              <button onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--brand-red)', cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 4px' }}>Clear all</button>
            </div>
          )}

          {!catalogLoading && items.length === 0 && (
            <div style={{ padding: '70px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 15 }}>
              No products match those filters.{' '}
              <button onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--brand-royal)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>Clear filters</button>
            </div>
          )}

          {catalogLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(255px,1fr))', gap: 20 }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="site-skel" style={{ aspectRatio: '1 / 1.4' }} />
              ))}
            </div>
          ) : view === 'grid' ? (
            <div ref={gridRef} data-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(255px,1fr))', gap: 20 }}>
              {shown.map((p) => (
                <ProductCard
                  key={p.id}
                  data-flip=""
                  brand={p.brand}
                  title={p.title}
                  image={p.image}
                  price={p.price}
                  compareAt={p.compareAt}
                  badge={p.badge}
                  badgeVariant={p.badgeVariant}
                  onClick={() => router.push('/product/' + p.id)}
                  onQuickAdd={() => add(p.id, 1)}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {shown.map((p) => (
                <ListRow key={p.id} p={p} onOpen={() => router.push('/product/' + p.id)} onAdd={() => add(p.id, 1)} />
              ))}
            </div>
          )}

          {items.length > visible && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36 }}>
              <Button variant="outline" onClick={() => setVisible((v) => v + 9)}>Load More</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- rail sub-components ---------- */

function SearchBox({ value, onChange }) {
  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input
        type="search"
        value={value}
        placeholder="Search the collection"
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px 10px 36px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--white)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)' }}
      />
    </div>
  );
}

function FacetGroup({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '4px 0 12px', marginBottom: 8 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)' }}>
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform var(--dur-fast)' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>{children}</div>}
    </div>
  );
}

function FacetRow({ label, count, on, onClick, radio, allRow }) {
  const [hover, setHover] = useState(false);
  const dim = count === 0 && !on && !allRow;
  return (
    <button
      type="button"
      onClick={dim ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={on}
      disabled={dim}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none',
        cursor: dim ? 'default' : 'pointer', padding: '6px 0', fontFamily: 'var(--font-body)', fontSize: 14.5,
        color: dim ? 'var(--gray-400)' : on ? 'var(--brand-royal)' : hover ? 'var(--ink)' : 'var(--text-body)',
        fontWeight: on ? 700 : 400, transition: 'color var(--dur-fast)',
      }}
    >
      <span style={{
        width: 16, height: 16, flexShrink: 0, borderRadius: radio ? '50%' : 3,
        border: on ? '2px solid var(--brand-royal)' : '2px solid var(--border-strong)',
        background: on ? 'var(--brand-royal)' : 'transparent',
        display: 'grid', placeItems: 'center', transition: 'border-color var(--dur-fast), background var(--dur-fast)',
      }}>
        {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {typeof count === 'number' && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
    </button>
  );
}

function ViewToggle({ view, setView }) {
  const btn = (v, children, label) => (
    <button type="button" onClick={() => setView(v)} aria-label={label} aria-pressed={view === v} data-cursor={label} style={{
      display: 'grid', placeItems: 'center', width: 36, height: 36, cursor: 'pointer', border: '1px solid var(--border-strong)',
      background: view === v ? 'var(--brand-navy)' : 'var(--white)', color: view === v ? '#fff' : 'var(--text-muted)',
      borderRadius: 'var(--radius-md)', transition: 'background var(--dur-fast), color var(--dur-fast)',
    }}>{children}</button>
  );
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {btn('grid', <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>, 'Grid view')}
      {btn('list', <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>, 'List view')}
    </div>
  );
}

function ListRow({ p, onOpen, onAdd }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', gap: 18, alignItems: 'center', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', padding: 12, boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)', transition: 'box-shadow var(--dur-normal) var(--ease-out)' }}
    >
      <button type="button" onClick={onOpen} aria-label={`View ${p.title}`} data-cursor="view" style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} />
      <div style={{ width: 128, height: 104, flexShrink: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--gray-100)' }}>
        <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: hover ? 'scale(1.05)' : 'none', transition: 'transform var(--dur-slow) var(--ease-out)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{p.brand}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16, color: 'var(--text-strong)', margin: '3px 0 6px' }}>{p.title}</div>
        <PriceTag price={p.price} compareAt={p.compareAt} />
      </div>
      <div style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <Button variant="primary" size="sm" arrow onClick={onAdd}>Add</Button>
      </div>
    </div>
  );
}
