'use client';

import React from 'react';
import Badge from './Badge';
import PriceTag from './PriceTag';

/**
 * ProductCard — the storefront catalog tile. Accessible (a stretched <button>
 * is the keyboard-focusable navigation target; the wishlist + quick-add controls
 * are siblings, never nested inside it). Premium hover: cursor-follow 3D tilt
 * (fine-pointer only), image zoom, a sheen sweep, and reveal of quick-add +
 * wishlist. All motion is transform/opacity and honors reduced motion.
 *
 * Props: title, image, price, compareAt, badge, badgeVariant, brand, onClick.
 * Optional: onQuickAdd() shows the Quick Add button; onWishlist()+wishlisted
 * make the heart controlled (otherwise it self-toggles for visual feedback).
 */
export default function ProductCard({
  title,
  image,
  price,
  compareAt,
  badge,
  badgeVariant = 'red',
  brand,
  onClick,
  onQuickAdd,
  onWishlist,
  wishlisted,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [coarse, setCoarse] = React.useState(false);
  const [wishLocal, setWishLocal] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const cardRef = React.useRef(null);
  const canTilt = React.useRef(false);
  const addTimer = React.useRef(null);

  const wished = onWishlist ? !!wishlisted : wishLocal;

  React.useEffect(() => {
    const mq = window.matchMedia;
    canTilt.current =
      !!mq &&
      mq('(hover: hover) and (pointer: fine)').matches &&
      !(mq('(prefers-reduced-motion: reduce)').matches || window.__JAYS_FORCE_REDUCED === true);
    setCoarse(!!mq && mq('(hover: none)').matches);
    return () => { if (addTimer.current) clearTimeout(addTimer.current); };
  }, []);

  const onMove = (e) => {
    const el = cardRef.current;
    if (!canTilt.current || !el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform =
      `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg) translateY(-6px) scale(1.015)`;
  };
  const reset = () => {
    setHover(false);
    if (cardRef.current) cardRef.current.style.transform = '';
  };

  const handleWish = (e) => {
    e.stopPropagation();
    if (onWishlist) onWishlist();
    else setWishLocal((v) => !v);
  };
  const handleQuickAdd = (e) => {
    e.stopPropagation();
    onQuickAdd?.();
    setAdded(true);
    if (addTimer.current) clearTimeout(addTimer.current);
    addTimer.current = setTimeout(() => setAdded(false), 1300);
  };

  // On touch devices (no hover), reveal quick-add + wishlist by default so
  // they're reachable — hover never fires there.
  const revealed = hover || coarse;
  const revealStyle = (shownExtra) => ({
    opacity: revealed || shownExtra ? 1 : 0,
    transition: 'opacity var(--dur-normal) var(--ease-out), transform var(--dur-normal) var(--ease-out)',
  });

  return (
    <article
      ref={cardRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={reset}
      onMouseMove={onMove}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        willChange: hover ? 'transform' : 'auto',
        transition:
          'box-shadow var(--dur-normal) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)',
        ...style,
      }}
      {...rest}
    >
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          aria-label={`View ${title}`}
          data-cursor="view"
          className="pc-nav"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          aspectRatio: '1 / 0.82',
          background: 'var(--gray-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {badge && (
          <span style={{ position: 'absolute', top: 12, left: 12, zIndex: 3 }}>
            <Badge variant={badgeVariant} size="md">{badge}</Badge>
          </span>
        )}

        <button
          type="button"
          onClick={handleWish}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          data-cursor="save"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 3,
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(4px)',
            cursor: 'pointer',
            transform: revealed || wished ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.9)',
            ...revealStyle(wished),
          }}
        >
          <HeartIcon filled={wished} />
        </button>

        {image ? (
          <img
            src={image}
            alt={title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform var(--dur-slow) var(--ease-out)',
              transform: hover ? 'scale(1.06)' : 'none',
            }}
          />
        ) : (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--gray-400)' }}>
            {brand || '★'}
          </span>
        )}

        {/* sheen sweep */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '45%',
            zIndex: 2,
            pointerEvents: 'none',
            background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.5), transparent)',
            transform: hover ? 'translateX(300%) skewX(-12deg)' : 'translateX(-170%) skewX(-12deg)',
            transition: 'transform 0.75s var(--ease-out)',
          }}
        />

        {onQuickAdd && (
          <div
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 10,
              zIndex: 3,
              transform: revealed ? 'translateY(0)' : 'translateY(150%)',
              ...revealStyle(false),
            }}
          >
            <button
              type="button"
              onClick={handleQuickAdd}
              data-cursor="add"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                background: added ? 'var(--success)' : 'var(--brand-red)',
                color: '#fff',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: 'var(--shadow-btn)',
                transition: 'background var(--dur-normal) var(--ease-out)',
              }}
            >
              {added ? 'Added ✓' : 'Quick Add'}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 16px 18px' }}>
        {brand && (
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {brand}
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 15,
            lineHeight: 1.35,
            color: 'var(--text-strong)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.7em',
          }}
        >
          {title}
        </span>
        <PriceTag price={price} compareAt={compareAt} />
      </div>
    </article>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'var(--brand-red)' : 'none'}
      stroke={filled ? 'var(--brand-red)' : 'var(--gray-500)'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: 'fill 0.2s, stroke 0.2s' }}
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}
