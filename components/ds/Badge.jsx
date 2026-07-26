import React from 'react';

/**
 * Badge — small status/label pill. Used for SALE, NEW, discounts, stock.
 * Sharp by default (matches the storefront); use pill for rounded.
 */
export default function Badge({
  children,
  variant = 'red',
  size = 'md',
  pill = false,
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '2px 7px',
      fontSize: '10px'
    },
    md: {
      padding: '3px 9px',
      fontSize: '11px'
    },
    lg: {
      padding: '5px 12px',
      fontSize: '13px'
    }
  };
  const variants = {
    red: {
      background: 'var(--brand-red)',
      color: 'var(--white)'
    },
    navy: {
      background: 'var(--brand-navy)',
      color: 'var(--white)'
    },
    royal: {
      background: 'var(--brand-royal)',
      color: 'var(--white)'
    },
    gold: {
      background: 'var(--brand-gold)',
      color: 'var(--navy-900)'
    },
    cream: {
      background: 'var(--cream-100)',
      color: 'var(--navy-800)'
    },
    outline: {
      background: 'transparent',
      color: 'var(--brand-navy)',
      boxShadow: 'inset 0 0 0 1px var(--border-strong)'
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-heading)',
        fontWeight: 600,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        lineHeight: 1.1,
        borderRadius: pill ? 'var(--radius-pill)' : 'var(--radius-xs)',
        whiteSpace: 'nowrap',
        ...sizes[size],
        ...variants[variant],
        ...style
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
