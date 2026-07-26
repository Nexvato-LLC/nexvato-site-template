'use client';

import React from 'react';

/**
 * IconButton — square/round icon control used in the storefront header
 * (search, cart, account). Pass any glyph/SVG as children.
 */
export default function IconButton({
  children,
  variant = 'ghost',
  shape = 'square',
  size = 'md',
  badge,
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  style,
  ...rest
}) {
  const dims = {
    sm: 34,
    md: 42,
    lg: 50
  }[size];
  const variants = {
    ghost: {
      background: 'transparent',
      color: 'var(--brand-navy)',
      border: '1px solid transparent'
    },
    outline: {
      background: 'var(--white)',
      color: 'var(--brand-navy)',
      border: '1px solid var(--border-strong)'
    },
    navy: {
      background: 'var(--brand-navy)',
      color: 'var(--white)',
      border: '1px solid var(--brand-navy)'
    },
    red: {
      background: 'var(--brand-red)',
      color: 'var(--white)',
      border: '1px solid var(--brand-red)'
    }
  };
  const [hover, setHover] = React.useState(false);
  const [pop, setPop] = React.useState(false);
  const prevBadge = React.useRef(badge);
  React.useEffect(() => {
    if (badge != null && prevBadge.current != null && badge !== prevBadge.current) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 280);
      prevBadge.current = badge;
      return () => clearTimeout(t);
    }
    prevBadge.current = badge;
    return undefined;
  }, [badge]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dims,
        height: dims,
        borderRadius: shape === 'round' ? 'var(--radius-circle)' : 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard)',
        filter: hover && !disabled ? 'brightness(0.94)' : 'none',
        ...variants[variant],
        ...style
      }}
      {...rest}
    >
      {children}
      {badge != null && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--brand-red)',
            color: 'var(--white)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 11,
            lineHeight: '18px',
            textAlign: 'center',
            boxShadow: '0 0 0 2px var(--white)',
            transform: pop ? 'scale(1.4)' : 'scale(1)',
            transition: 'transform var(--dur-fast) var(--spring, cubic-bezier(0.34,1.56,0.64,1))'
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
