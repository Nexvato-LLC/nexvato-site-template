import React from 'react';
import Eyebrow from './Eyebrow';

/**
 * SectionHeading — the heavy condensed uppercase band title used across the
 * storefront ("SHOP BY BRANDS", "FOLDS OF HONOR FOUNDATION"). Optional
 * eyebrow above and lead paragraph below.
 */
export default function SectionHeading({
  title,
  eyebrow,
  eyebrowColor = 'royal',
  subtitle,
  align = 'center',
  size = 'md',
  onDark = false,
  style,
  ...rest
}) {
  const sizes = {
    sm: 'var(--text-2xl)',
    md: 'var(--text-3xl)',
    lg: 'var(--text-4xl)',
    xl: 'var(--text-5xl)'
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
        gap: 'var(--space-3)',
        ...style
      }}
      {...rest}
    >
      {eyebrow && <Eyebrow color={onDark ? 'onDark' : eyebrowColor}>{eyebrow}</Eyebrow>}
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: sizes[size],
          lineHeight: 1.02,
          letterSpacing: '0.01em',
          textTransform: 'uppercase',
          color: onDark ? 'var(--white)' : 'var(--text-strong)'
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            margin: 0,
            maxWidth: 560,
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            lineHeight: 1.6,
            color: onDark ? 'var(--text-on-dark-muted)' : 'var(--text-muted)'
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
