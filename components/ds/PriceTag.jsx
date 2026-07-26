import React from 'react';

/**
 * PriceTag — royal-blue price with optional struck-through compare-at price.
 * Matches the storefront ($37.00  $49.00).
 */
export default function PriceTag({
  price,
  compareAt,
  currency = '$',
  size = 'md',
  style,
  ...rest
}) {
  const sizes = {
    sm: 14,
    md: 16,
    lg: 22
  };
  const fs = sizes[size];
  const fmt = n => (typeof n === 'number' ? `${currency}${n.toFixed(2)}` : n);
  const onSale = compareAt != null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 8,
        ...style
      }}
      {...rest}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: fs,
          color: onSale ? 'var(--price-sale)' : 'var(--price)',
          letterSpacing: '0.01em'
        }}
      >
        {fmt(price)}
      </span>
      {onSale && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: fs - 3,
            color: 'var(--price-strike)',
            textDecoration: 'line-through'
          }}
        >
          {fmt(compareAt)}
        </span>
      )}
    </span>
  );
}
