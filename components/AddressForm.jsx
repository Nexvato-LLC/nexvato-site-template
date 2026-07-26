'use client';

import Input from '@/components/ds/Input';

export const EMPTY_ADDRESS = { first_name: '', last_name: '', address_1: '', city: '', province: '', postal_code: '', phone: '' };

/** Strip a Medusa/customer address down to the fields the cart + address API accept. */
export function toShippingAddress(a) {
  return {
    first_name: a.first_name || '',
    last_name: a.last_name || '',
    address_1: a.address_1 || '',
    city: a.city || '',
    province: a.province || '',
    postal_code: a.postal_code || '',
    phone: a.phone || '',
    country_code: 'us',
  };
}

export function isAddressComplete(a) {
  return !!(a && a.first_name && a.last_name && a.address_1 && a.city && a.province && a.postal_code);
}

const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };
const field = { display: 'flex', flexDirection: 'column', gap: 6 };

/**
 * Shared shipping-address fields. Controlled: `value` is an address object and
 * `onChange(next)` receives the whole updated object. Used by /checkout and the
 * /account address book so the two never drift.
 */
export default function AddressForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(150px,100%),1fr))', gap: 14 }}>
      <div style={field}><span style={lbl}>First name</span><Input value={value.first_name || ''} onChange={set('first_name')} /></div>
      <div style={field}><span style={lbl}>Last name</span><Input value={value.last_name || ''} onChange={set('last_name')} /></div>
      <div style={{ ...field, gridColumn: '1 / -1' }}><span style={lbl}>Address</span><Input value={value.address_1 || ''} onChange={set('address_1')} /></div>
      <div style={field}><span style={lbl}>City</span><Input value={value.city || ''} onChange={set('city')} /></div>
      <div style={field}><span style={lbl}>State</span><Input value={value.province || ''} onChange={set('province')} placeholder="e.g. IL" /></div>
      <div style={field}><span style={lbl}>ZIP code</span><Input value={value.postal_code || ''} onChange={set('postal_code')} /></div>
      <div style={field}><span style={lbl}>Phone (optional)</span><Input value={value.phone || ''} onChange={set('phone')} /></div>
    </div>
  );
}
