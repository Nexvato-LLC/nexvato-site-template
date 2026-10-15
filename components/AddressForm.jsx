'use client';

import { useState } from 'react';
import Input from '@/components/ds/Input';
import { US_STATES, isStateCode, normalizeState } from '@/lib/us-states';
import { EMAIL_RE, ZIP_RE } from '@/lib/validation';

export const EMPTY_ADDRESS = { first_name: '', last_name: '', address_1: '', city: '', province: '', postal_code: '', phone: '' };

/** Strip an address down to the fields the cart + address API accept. */
export function toShippingAddress(a) {
  return {
    first_name: a.first_name || '',
    last_name: a.last_name || '',
    address_1: a.address_1 || '',
    address_2: a.address_2 || '',
    city: a.city || '',
    province: normalizeState(a.province),
    postal_code: (a.postal_code || '').trim(),
    phone: (a.phone || '').trim(),
    country_code: 'us',
  };
}

export { ZIP_RE, EMAIL_RE };

/**
 * Per-field problems with an address; {} when it is good to ship to.
 * The server enforces the same rules — this is the fast, friendly layer, so a
 * typo is flagged beside the field instead of surfacing as a failed order.
 */
export function validateAddress(a) {
  const e = {};
  const x = a || {};
  if (!String(x.first_name || '').trim()) e.first_name = 'Enter a first name.';
  if (!String(x.last_name || '').trim()) e.last_name = 'Enter a last name.';
  if (!String(x.address_1 || '').trim()) e.address_1 = 'Enter a street address.';
  if (!String(x.city || '').trim()) e.city = 'Enter a city.';
  if (!isStateCode(normalizeState(x.province))) e.province = 'Choose a state.';
  if (!ZIP_RE.test(String(x.postal_code || '').trim())) e.postal_code = 'Enter a 5-digit ZIP code (like 62701).';
  const phone = String(x.phone || '').trim();
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (!/^[+()\-.\s\d]+$/.test(phone) || digits.length < 10 || digits.length > 15) {
      e.phone = 'Enter a phone number with 10 to 15 digits, or leave it blank.';
    }
  }
  return e;
}

export function isAddressComplete(a) {
  return !!a && Object.keys(validateAddress(a)).length === 0;
}

/** One line for lists: "1 Main St, Springfield, IL 62701". */
export function oneLineAddress(a) {
  const cityState = [a.city, [a.province, a.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [a.address_1, a.address_2, cityState].filter(Boolean).join(', ');
}

const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };
const field = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };
const errStyle = { margin: 0, fontSize: 12.5, lineHeight: 1.4, color: 'var(--danger)' };

/**
 * Shared shipping-address fields. Controlled: `value` is an address object and
 * `onChange(next)` receives the whole updated object. Used by /checkout and the
 * /account address book so the two never drift.
 *
 * A field's message appears once the shopper has left it (or `showErrors` is
 * set, e.g. after a failed submit) — not while they are still typing it.
 */
export default function AddressForm({ value, onChange, showErrors = false }) {
  const [touched, setTouched] = useState({});
  const errors = validateAddress(value);
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k) => ((showErrors || touched[k]) ? errors[k] : undefined);

  // `1fr` alone lets a long value widen its column past the card; minmax(0,…) caps it.
  const text = (k, label, extra = {}) => (
    <div style={{ ...field, ...(extra.wide ? { gridColumn: '1 / -1' } : {}) }}>
      <span style={lbl}>{label}</span>
      <Input
        value={value[k] || ''}
        onChange={set(k)}
        onBlur={blur(k)}
        invalid={!!err(k)}
        aria-invalid={!!err(k)}
        placeholder={extra.placeholder}
        inputMode={extra.inputMode}
        autoComplete={extra.autoComplete}
        maxLength={extra.maxLength}
      />
      {err(k) && <p role="alert" style={errStyle}>{err(k)}</p>}
    </div>
  );

  const province = normalizeState(value.province);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(150px,100%),1fr))', gap: 14 }}>
      {text('first_name', 'First name', { autoComplete: 'given-name' })}
      {text('last_name', 'Last name', { autoComplete: 'family-name' })}
      {text('address_1', 'Address', { wide: true, autoComplete: 'address-line1' })}
      {text('city', 'City', { autoComplete: 'address-level2' })}
      <div style={field}>
        <span style={lbl}>State</span>
        <div style={{ display: 'flex', alignItems: 'center', height: 46, padding: '0 10px', background: 'var(--white)', border: `1px solid ${err('province') ? 'var(--brand-red)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', minWidth: 0 }}>
          <select
            aria-label="State"
            aria-invalid={!!err('province')}
            autoComplete="address-level1"
            value={province}
            onChange={(e) => onChange({ ...value, province: e.target.value })}
            onBlur={blur('province')}
            style={{ flex: 1, width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, color: province ? 'var(--text-strong)' : 'var(--text-muted)' }}
          >
            <option value="">Select…</option>
            {US_STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
          </select>
        </div>
        {err('province') && <p role="alert" style={errStyle}>{err('province')}</p>}
      </div>
      {text('postal_code', 'ZIP code', { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 10 })}
      {text('phone', 'Phone (optional)', { inputMode: 'tel', autoComplete: 'tel', maxLength: 24 })}
    </div>
  );
}
