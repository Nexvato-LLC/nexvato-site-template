'use client';

import React from 'react';

/**
 * BrandChip — a partner-brand pill for the "Shop by Brands" strip. White card
 * that lifts on hover with a royal border, a wordmark that shifts to royal, and
 * a red accent bar that grows along the bottom. Pass a `logo` image, or it falls
 * back to the brand name as a condensed wordmark.
 */
export default function BrandChip({
  logo,
  name,
  active = false,
  onClick,
  size = 'md',
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const dims = {
    sm: { w: 124, h: 56 },
    md: { w: 160, h: 74 },
    lg: { w: 188, h: 84 }
  }[size];
  const on = active || hover;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={active}
      title={name}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dims.w,
        height: dims.h,
        padding: '10px 18px',
        background: 'var(--white)',
        border: `1px solid ${on ? 'var(--brand-royal)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: on ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        cursor: 'pointer',
        overflow: 'hidden',
        transform: hover && !active ? 'translateY(-4px)' : 'none',
        transition:
          'box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-out)',
        ...style
      }}
      {...rest}
    >
      {logo ? (
        <img
          src={logo}
          alt={name}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            filter: on ? 'none' : 'grayscale(1)',
            opacity: on ? 1 : 0.85,
            transition: 'filter var(--dur-normal), opacity var(--dur-normal)'
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: on ? 'var(--brand-royal)' : 'var(--ink)',
            transition: 'color var(--dur-fast) var(--ease-standard)'
          }}
        >
          {name}
        </span>
      )}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: 'var(--brand-red)',
          transform: on ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'center',
          transition: 'transform var(--dur-normal) var(--ease-out)'
        }}
      />
    </button>
  );
}
