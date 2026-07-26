'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  retrieveCustomer, listCustomerOrders, createCustomerAddress,
  updateCustomerAddress, deleteCustomerAddress,
} from '@/lib/shop';
import { useAuth } from '@/components/AuthProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import Input from '@/components/ds/Input';
import AddressForm, { EMPTY_ADDRESS, toShippingAddress, isAddressComplete } from '@/components/AddressForm';

const money = (n) => '$' + Number(n || 0).toFixed(2);
const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };
const oneLine = (a) => [a.address_1, a.city, a.province, a.postal_code].filter(Boolean).join(', ');
const card = { border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 22px', background: 'var(--white)' };
const cardHead = { margin: '0 0 14px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)' };

/** Map the shared AddressForm shape onto the Shop engine's field names. */
function toShopAddress(a) {
  return {
    firstName: a.first_name || a.firstName || null,
    lastName: a.last_name || a.lastName || null,
    line1: a.address_1 || a.line1 || '',
    line2: a.address_2 || a.line2 || null,
    city: a.city || '',
    province: a.province || null,
    postalCode: a.postal_code || a.postalCode || '',
    country: (a.country_code || a.country || 'us').toLowerCase(),
    phone: a.phone || null,
  };
}

export default function AccountPage() {
  useStorefrontMotion();
  const router = useRouter();
  const { customer, authLoading, login, register, logout } = useAuth();

  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | address id
  const [formAddr, setFormAddr] = useState(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);

  // auth form (logged out)
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState('');

  const loadAddresses = () =>
    // Addresses come back nested on the customer now, rather than from a
    // separate list endpoint.
    retrieveCustomer().then((c) => setAddresses(c?.addresses || [])).catch(() => setAddresses([]));

  useEffect(() => {
    if (!customer) { setOrders([]); setAddresses([]); return; }
    listCustomerOrders()
      .then((orders) => ({ orders }))
      .then(({ orders: o }) => setOrders(o || [])).catch(() => setOrders([]));
    loadAddresses();
  }, [customer]);

  const submitAuth = async (e) => {
    e.preventDefault();
    if (authBusy) return;
    setAuthBusy(true); setError('');
    try {
      if (mode === 'register') await register(form);
      else await login(form.email, form.password);
    } catch {
      setError(mode === 'register' ? 'Could not create that account — the email may already be registered. Try signing in.' : 'Invalid email or password.');
    } finally { setAuthBusy(false); }
  };

  const startAdd = () => { setFormAddr(EMPTY_ADDRESS); setEditing('new'); };
  const startEdit = (a) => { setFormAddr(a); setEditing(a.id); };
  const saveAddress = async () => {
    if (!isAddressComplete(formAddr) || busy) return;
    setBusy(true);
    try {
      if (editing === 'new') await createCustomerAddress(toShopAddress(formAddr));
      else await updateCustomerAddress(editing, toShopAddress(formAddr));
      setEditing(null);
      await loadAddresses();
    } catch (e) { /* noop */ } finally { setBusy(false); }
  };
  const removeAddress = async (id) => {
    setBusy(true);
    try { await deleteCustomerAddress(id); await loadAddresses(); } catch (e) {} finally { setBusy(false); }
  };
  const makeDefault = async (id) => {
    setBusy(true);
    try { await updateCustomerAddress(id, { isDefault: true }); await loadAddresses(); } catch (e) {} finally { setBusy(false); }
  };

  if (authLoading) {
    return <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 13 }}>Loading…</div>;
  }

  /* ---- Logged out ---- */
  if (!customer) {
    const tab = (m, t) => (
      <button type="button" onClick={() => { setMode(m); setError(''); }} style={{ flex: 1, padding: '12px 0', cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${mode === m ? 'var(--brand-royal)' : 'var(--border)'}`, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: mode === m ? 'var(--ink)' : 'var(--text-muted)' }}>{t}</button>
    );
    const fld = { display: 'flex', flexDirection: 'column', gap: 6 };
    return (
      <div data-screen-label="Account" style={{ maxWidth: 460, margin: '0 auto', padding: '56px 24px 90px' }}>
        <div data-rise style={{ textAlign: 'center', marginBottom: 24 }}>
          <Eyebrow color="royal" rule>Members</Eyebrow>
          <h1 style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,5vw,50px)', textTransform: 'uppercase', color: 'var(--ink)' }}>{mode === 'register' ? 'Join the Roster' : 'Welcome Back'}</h1>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--white)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex' }}>{tab('login', 'Sign In')}{tab('register', 'Create Account')}</div>
          <form onSubmit={submitAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px' }}>
            {mode === 'register' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fld}><span style={lbl}>First name</span><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div style={fld}><span style={lbl}>Last name</span><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
            )}
            <div style={fld}><span style={lbl}>Email</span><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div style={fld}><span style={lbl}>Password</span><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            {error && <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5 }}>{error}</p>}
            <Button type="submit" variant="primary" size="lg" fullWidth arrow={!authBusy} disabled={authBusy}>{authBusy ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}</Button>
          </form>
        </div>
      </div>
    );
  }

  /* ---- Logged in ---- */
  return (
    <div data-screen-label="Account" style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div data-rise style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 30 }}>
        <div>
          <Eyebrow color="royal" rule>Your Account</Eyebrow>
          <h1 style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,4.4vw,52px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Hey, {customer.first_name || 'friend'}</h1>
        </div>
        <Button variant="outline" onClick={logout}>Sign Out</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 24, alignItems: 'start' }}>
        <div style={card}>
          <h2 style={cardHead}>Profile</h2>
          <div style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text-body)' }}>
            <div><strong style={{ color: 'var(--text-strong)' }}>{customer.first_name} {customer.last_name}</strong></div>
            <div>{customer.email}</div>
          </div>
        </div>

        <div style={{ ...card, gridColumn: 'span 2', minWidth: 0 }}>
          <h2 style={cardHead}>Order history</h2>
          {orders.length === 0 ? (
            <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 14 }}>No orders yet. <button onClick={() => router.push('/shop')} style={{ background: 'none', border: 'none', color: 'var(--brand-royal)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>Start shopping</button></div>
          ) : (
            orders.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Order #{o.display_id}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()} · {(o.items || []).reduce((t, it) => t + (it.quantity || 0), 0)} item(s)</div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{money(o.total)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Address book */}
      <div style={{ ...card, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ ...cardHead, margin: 0 }}>Address book</h2>
          {editing === null && <Button variant="outline" size="sm" onClick={startAdd}>Add address</Button>}
        </div>

        {editing !== null ? (
          <div>
            <AddressForm value={formAddr} onChange={setFormAddr} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Button variant="primary" onClick={saveAddress} disabled={busy || !isAddressComplete(formAddr)}>{busy ? 'Saving…' : 'Save address'}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        ) : addresses.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>No saved addresses yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {addresses.map((a) => (
              <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: 'var(--text-strong)' }}>{a.first_name} {a.last_name}</strong>
                  {a.is_default_shipping && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-royal)', background: 'var(--royal-100)', padding: '2px 7px', borderRadius: 3 }}>Default</span>}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-body)', margin: '6px 0 12px', lineHeight: 1.5 }}>{oneLine(a)}</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
                  <button onClick={() => startEdit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', padding: 0 }}>Edit</button>
                  {!a.is_default_shipping && <button onClick={() => makeDefault(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', padding: 0 }}>Make default</button>}
                  <button onClick={() => removeAddress(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-red)', padding: 0 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
