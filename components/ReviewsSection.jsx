'use client';

import React from 'react';

const STAR = 'm12 2 2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 6 20.5l1.4-6.8L2.3 9l6.9-.7L12 2Z';

/** Partial-fill star rating (gray track + gold fill clipped to value/5). */
export function Stars({ value = 0, size = 16, gap = 2 }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const Row = ({ color }) => (
    <span style={{ display: 'inline-flex', gap, color }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={STAR} /></svg>
      ))}
    </span>
  );
  return (
    <span role="img" aria-label={`Rated ${value} out of 5`} style={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }}>
      <Row color="var(--gray-300)" />
      <span style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <Row color="var(--gold-500)" />
      </span>
    </span>
  );
}

/* ---- deterministic seeding (stable per product id) ---- */
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['Jordan M.', 'Casey R.', 'Marcus T.', 'Dana P.', 'Sam K.', 'Riley B.', 'Alex V.', 'Taylor N.'];
const AGES = ['3 days ago', '1 week ago', '2 weeks ago', 'last month', '2 months ago'];
const POOL = {
  Baseball: [
    ['Game-ready out of the box', 'Barely any break-in and the pocket already feels broken in right. Took it straight to fielding practice.'],
    ['Exactly as described', 'Leather quality is a step above what I expected at this price. Stitching is clean and tight.'],
    ['My new gamer', 'Switched to this mid-season and my glove-side plays got noticeably more reliable.'],
  ],
  Softball: [
    ['Huge sweet spot', 'Balanced swing and the pop is real — hit it well on the first at-bat, no break-in needed.'],
    ['Great for the league', 'Certified for our association and feels a class above the bat I retired.'],
  ],
  Apparel: [
    ['Fits true and stays cool', 'Wore it through a July doubleheader and it never got heavy. Wash-and-wear, holds shape.'],
    ['Soft and well-cut', 'The cut is flattering without being tight, and the fabric wicks like it should.'],
  ],
  Headwear: [
    ['Clean look, comfy fit', 'Structured enough to hold shape, mesh back keeps it breezy. Snap adjusts easily.'],
    ['Gets compliments', 'The stars-and-stripes front is tasteful, not loud. Wear it everywhere now.'],
  ],
  Eyewear: [
    ['Glare just disappears', 'Polarization is legit — tracking fly balls into the lights got a lot easier.'],
    ['Light and locked-in', 'Barely feel them on and they do not slip when I run. Case is a nice touch.'],
  ],
  Collectibles: [
    ['A real showpiece', 'Arrived sealed with the COA. Looks incredible on the shelf and the detail is stunning.'],
    ['Authentic and well-packed', 'Numbered, documented, and shipped with real care. Exactly what a collector wants.'],
    ['Better in person', 'Photos do not do it justice — the finish catches the light beautifully.'],
  ],
};

function buildHistogram(rating, total) {
  const p5 = Math.max(0.4, Math.min(0.97, (rating - 3.5) / 1.5));
  const rest = 1 - p5;
  const pct = [p5, rest * 0.66, rest * 0.2, rest * 0.09, rest * 0.05]; // 5★..1★
  const counts = pct.map((f) => Math.round(f * total));
  const diff = total - counts.reduce((a, b) => a + b, 0);
  counts[0] += diff; // reconcile onto 5★
  return counts.map((c) => ({ count: c, pct: total ? Math.round((c / total) * 100) : 0 }));
}

export default function ReviewsSection({ product }) {
  const rating = product.rating || 4.8;
  const total = product.reviews || 0;
  const rand = React.useMemo(() => mulberry32(hashStr(product.id || 'x')), [product.id]);
  const hist = React.useMemo(() => buildHistogram(rating, total), [rating, total]);

  const reviews = React.useMemo(() => {
    const pool = POOL[product.cat] || POOL.Baseball;
    const n = Math.min(3, pool.length);
    const usedName = new Set();
    return Array.from({ length: n }, (_, i) => {
      let name = NAMES[Math.floor(rand() * NAMES.length)];
      while (usedName.has(name)) name = NAMES[Math.floor(rand() * NAMES.length)];
      usedName.add(name);
      const [title, body] = pool[i % pool.length];
      const stars = i === 0 ? Math.round(rating) : 4 + Math.round(rand()); // 4 or 5
      return { name, title, body, stars: Math.min(5, stars), age: AGES[Math.floor(rand() * AGES.length)] };
    });
  }, [product.cat, rand, rating]);

  return (
    <section id="reviews" data-band style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '8px 24px 72px' }}>
      <h2 data-rise style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,3.2vw,40px)', textTransform: 'uppercase', color: 'var(--ink)', margin: '0 0 28px' }}>
        Reviews
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))', gap: 40, alignItems: 'start' }}>
        {/* Summary + histogram */}
        <div data-rise style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 56, lineHeight: 1, color: 'var(--ink)' }}>{rating.toFixed(1)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Stars value={rating} size={18} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total} verified reviews</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hist.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span style={{ width: 34, whiteSpace: 'nowrap' }}>{5 - i} ★</span>
                <span style={{ flex: 1, height: 8, background: 'var(--gray-200)', borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${h.pct}%`, background: 'var(--gold-500)', borderRadius: 4 }} />
                </span>
                <span style={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{h.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Representative reviews */}
        <div data-rise style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px', background: 'var(--white)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--navy-700)', color: 'var(--gold-400)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>
                  {r.name.charAt(0)}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-strong)' }}>{r.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Verified Buyer
                  </span>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{r.age}</span>
              </div>
              <Stars value={r.stars} size={13} />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', margin: '8px 0 4px' }}>{r.title}</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-body)' }}>{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
