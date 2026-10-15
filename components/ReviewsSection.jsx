'use client';

import { useState } from 'react';
import { fetchProductReviews } from '@/lib/shop';

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

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Real reviews only.
 *
 * This used to invent reviews: a hardcoded pool of "Verified Buyer" quotes (about
 * baseball gloves, whatever the product) under a 4.8 rating, on every product
 * of every store (support #213). Everything here now comes from the reviews
 * endpoint, which only holds reviews written by customers who bought the
 * product. With none, it says so.
 *
 * `reviews` is the first page, fetched by the product page (it also needs the
 * average for the rating line under the title); this component pages the rest.
 */
export default function ReviewsSection({ productId, reviews: first }) {
  const [extra, setExtra] = useState([]);
  const [page, setPage] = useState(first?.page || 1);
  const [hasNext, setHasNext] = useState(!!first?.hasNext);
  const [loading, setLoading] = useState(false);

  // Reviews failed to load: show nothing rather than a guess.
  if (!first) return null;

  const list = [...first.reviews, ...extra];
  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    const next = await fetchProductReviews(productId, page + 1);
    setLoading(false);
    if (!next) return;
    setExtra((e) => [...e, ...next.reviews]);
    setPage(next.page);
    setHasNext(next.hasNext);
  };

  return (
    <section id="reviews" data-band style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '8px 24px 72px' }}>
      <h2 data-rise style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,3.2vw,40px)', textTransform: 'uppercase', color: 'var(--ink)', margin: '0 0 28px' }}>
        Reviews
      </h2>

      {first.total === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)', maxWidth: '56ch', lineHeight: 1.6 }}>
          No reviews yet. Reviews appear here after customers who bought this product share what they thought.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))', gap: 40, alignItems: 'start' }}>
          <div data-rise style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 56, lineHeight: 1, color: 'var(--ink)' }}>{(first.average || 0).toFixed(1)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Stars value={first.average || 0} size={18} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{first.total} verified {first.total === 1 ? 'review' : 'reviews'}</span>
            </div>
          </div>

          <div data-rise style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {list.map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px', background: 'var(--white)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', background: 'var(--navy-700)', color: 'var(--white)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.name}</span>
                    {r.verified && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        Verified purchase
                      </span>
                    )}
                  </div>
                  <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{when(r.createdAt)}</span>
                </div>
                <Stars value={r.rating} size={13} />
                {r.title && <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', margin: '8px 0 4px', overflowWrap: 'anywhere' }}>{r.title}</div>}
                <p style={{ margin: r.title ? 0 : '8px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-body)', overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{r.body}</p>
              </div>
            ))}
            {hasNext && (
              <button type="button" onClick={loadMore} disabled={loading} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-royal)', fontWeight: 700, textDecoration: 'underline', padding: 0 }}>
                {loading ? 'Loading…' : 'Show more reviews'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
