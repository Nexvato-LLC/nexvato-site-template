'use client';

import React from 'react';

/**
 * Input — text/search field for the storefront (newsletter, search, forms).
 * Optional leading icon and label; sharp corners, royal focus ring.
 */
export default function Input({
  label,
  type = 'text',
  placeholder,
  value,
  defaultValue,
  icon,
  size = 'md',
  disabled = false,
  invalid = false,
  onChange,
  style,
  id,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const heights = {
    sm: 38,
    md: 46,
    lg: 54
  };
  const h = heights[size];
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        ...style
      }}
    >
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-strong)'
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: h,
          padding: '0 14px',
          background: disabled ? 'var(--gray-100)' : 'var(--white)',
          border: `1px solid ${invalid ? 'var(--brand-red)' : focus ? 'var(--brand-royal)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: focus ? 'var(--focus-ring)' : 'none',
          transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)'
        }}
      >
        {icon && (
          <span
            style={{
              display: 'inline-flex',
              color: 'var(--text-muted)'
            }}
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--text-strong)',
            minWidth: 0
          }}
          {...rest}
        />
      </div>
    </div>
  );
}
