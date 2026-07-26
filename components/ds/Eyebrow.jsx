import React from 'react';

/**
 * Eyebrow — small caps label that sits above a heading. On the reference
 * storefront it appears in royal blue ("We stand proudly with the").
 */
export default function Eyebrow({
  children,
  color = 'royal',
  align = 'left',
  rule = false,
  style,
  ...rest
}) {
  const colors = {
    royal: 'var(--brand-royal)',
    red: 'var(--brand-red)',
    navy: 'var(--brand-navy)',
    gold: 'var(--gold-600)',
    muted: 'var(--text-muted)',
    onDark: 'var(--gold-400)'
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        fontSize: 'var(--text-sm)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: colors[color],
        textAlign: align,
        ...style
      }}
      {...rest}
    >
      {rule && (
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 2,
            background: 'currentColor',
            display: 'inline-block'
          }}
        />
      )}
      {children}
    </span>
  );
}
