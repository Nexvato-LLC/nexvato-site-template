'use client';

import React from 'react';

/**
 * Button
 * Sharp-cornered, athletic CTA. Uppercase condensed label with optional
 * trailing ► chevron (a brand signature on the reference storefront).
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  arrow = false,
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '8px 16px',
      fontSize: '12px',
      gap: '8px'
    },
    md: {
      padding: '12px 22px',
      fontSize: '14px',
      gap: '10px'
    },
    lg: {
      padding: '16px 30px',
      fontSize: '16px',
      gap: '12px'
    }
  };
  const variants = {
    primary: {
      background: 'var(--brand-red)',
      color: 'var(--white)',
      border: '1px solid var(--brand-red)',
      boxShadow: 'var(--shadow-btn)'
    },
    navy: {
      background: 'var(--brand-navy)',
      color: 'var(--white)',
      border: '1px solid var(--brand-navy)',
      boxShadow: 'var(--shadow-sm)'
    },
    royal: {
      background: 'var(--brand-royal)',
      color: 'var(--white)',
      border: '1px solid var(--brand-royal)',
      boxShadow: 'var(--shadow-sm)'
    },
    outline: {
      background: 'transparent',
      color: 'var(--brand-navy)',
      border: '1px solid var(--border-strong)',
      boxShadow: 'none'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--brand-red)',
      border: '1px solid transparent',
      boxShadow: 'none'
    }
  };
  const base = {
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizes[size].gap,
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    lineHeight: 1,
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    padding: sizes[size].padding,
    fontSize: sizes[size].fontSize,
    transition:
      'transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard)',
    ...variants[variant],
    ...style
  };
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const interactive = !disabled;
  const dyn = interactive
    ? {
        filter: hover ? 'brightness(0.93)' : 'none',
        transform: active ? 'translateY(1px)' : 'none'
      }
    : {};

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        ...base,
        ...dyn
      }}
      {...rest}
    >
      {children}
      {arrow && (
        <span
          aria-hidden="true"
          style={{
            fontSize: '0.85em',
            lineHeight: 1,
            transform: hover && interactive ? 'translate(4px, 0.5px)' : 'translate(0, 0.5px)',
            transition: 'transform var(--dur-fast) var(--ease-out)'
          }}
        >
          {'▶'}
        </span>
      )}
    </button>
  );
}
