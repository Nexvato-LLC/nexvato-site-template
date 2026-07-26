'use client';

import React from 'react';

/**
 * PromoCard — the "UP TO 30% OFF BRANDS" feature tile: a background image
 * with an overlaid heavy condensed headline and optional eyebrow.
 * Mirrors the reference storefront's dual promo band.
 */
export default function PromoCard({
  eyebrow,
  title,
  image,
  href = '#',
  align = 'left',
  overlay = 'light',
  height = 260,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const overlays = {
    light:
      'linear-gradient(90deg, rgba(242,242,242,0.96) 0%, rgba(242,242,242,0.72) 42%, rgba(242,242,242,0) 78%)',
    navy: 'linear-gradient(90deg, rgba(16,35,61,0.92) 0%, rgba(16,35,61,0.55) 48%, rgba(16,35,61,0.05) 82%)',
    none: 'none'
  };
  const isDark = overlay === 'navy';

  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'block',
        height,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        textDecoration: 'none',
        boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        ...style
      }}
      {...rest}
    >
      {image && (
        <img
          src={image}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform var(--dur-slow) var(--ease-out)',
            transform: hover ? 'scale(1.04)' : 'none'
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: overlays[overlay]
        }}
      />
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
          padding: '28px 32px',
          alignItems: align === 'right' ? 'flex-end' : 'flex-start',
          textAlign: align,
          maxWidth: '70%'
        }}
      >
        {eyebrow && (
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isDark ? 'var(--gold-400)' : 'var(--brand-royal)'
            }}
          >
            {eyebrow}
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 34,
            lineHeight: 1.0,
            letterSpacing: '0.01em',
            textTransform: 'uppercase',
            color: isDark ? 'var(--white)' : 'var(--ink)'
          }}
        >
          {title}
        </span>
      </div>
    </a>
  );
}
