'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  retrieveCustomer, listCustomerOrders, createCustomerAddress,
  updateCustomerAddress, deleteCustomerAddress, setDefaultCustomerAddress,
} from '@/lib/shop';
import { authErrorMessage, validateAuth } from '@/lib/auth-messages';
import { useAuth } from '@/components/AuthProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import Input from '@/components/ds/Input';
import { normalizeState } from '@/lib/us-states';
import AddressForm, { EMPTY_ADDRESS, toShippingAddress, isAddressComplete, oneLineAddress } from '@/components/AddressForm';

const money = (n) => '$' + Number(n || 0).toFixed(2);
const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };
const card = { border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 22px', background: 'var(--white)' };
const cardHead = { margin: '0 0 14px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)' };
const fieldErr = { margin: 0, fontSize: 12.5, lineHeight: 1.4, color: 'var(--danger)' };

export default function AccountPage() {
  useStorefrontMotion();
  const router = useRouter();
  const { customer, authLoading, login, register, logout } = useAuth();

  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | address id
  const [formAddr, setFormAddr] = useState(EMPTY_ADDRESS);
  const [showAddrErrors, setShowAddrErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addrError, setAddrError] = useState('');

  // auth form (logged out)
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState('');

  const loadAddresses = () =>
    // Addresses come back nested on the customer, already mapped to the UI shape.
    retrieveCustomer().then((c) => setAddresses(c?.addresses || [])).catch(() => setAddresses([]));

  useEffect(() => {
    if (!customer) { setOrders([]); setAddresses([]); return; }
    listCustomerOrders().then((o) => setOrders(o || [])).catch(() => setOrders([]));
    loadAddresses();
  }, [customer]);

  const authErrors = validateAuth(form, mode);
  const showAuthErr = (k) => (submitted || touched[k]) && authErrors[k];

  const submitAuth = async (e) => {
    e.preventDefault();
    if (authBusy) return;
    setSubmitted(true);
    setError('');
    // Don't spend a request on something we can see is wrong.
    if (Object.keys(authErrors).length) return;
    setAuthBusy(true);
    try {
      if (mode === 'register') await register({ ...form, email: form.email.trim() });
      else await login(form.email.trim(), form.password);
    } catch (err) {
      setError(authErrorMessage(err, mode));
    } finally { setAuthBusy(false); }
  };

  const startAdd = () => { setFormAddr(EMPTY_ADDRESS); setShowAddrErrors(false); setAddrError(''); setEditing('new'); };
  const startEdit = (a) => { setFormAddr({ ...a, province: normalizeState(a.province) }); setShowAddrErrors(false); setAddrError(''); setEditing(a.id); };
  const saveAddress = async () => {
    if (busy) return;
    if (!isAddressComplete(formAddr)) { setShowAddrErrors(true); return; }
    setBusy(true); setAddrError('');
    try {
      const body = toShippingAddress(formAddr);
      if (editing === 'new') await createCustomerAddress(body);
      else await updateCustomerAddress(editing, body);
      setEditing(null);
      await loadAddresses();
    } catch (err) {
      // The API's own words ("province must be a valid 2-letter US state…"), not a silent no-op.
      setAddrError(err?.message || 'We couldn’t save that address. Please try again.');
    } finally { setBusy(false); }
  };
  const removeAddress = async (id) => {
    setBusy(true); setAddrError('');
    try { await deleteCustomerAddress(id); await loadAddresses(); } catch (err) { setAddrError(err?.message || 'We couldn’t delete that address.'); } finally { setBusy(false); }
  };
  const makeDefault = async (id) => {
    setBusy(true); setAddrError('');
    try { await setDefaultCustomerAddress(id); await loadAddresses(); } catch (err) { setAddrError(err?.message || 'We couldn’t update your default address.'); } finally { setBusy(false); }
  };

  if (authLoading) {
    return <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 13 }}>Loading…</div>;
  }

  /* ---- Logged out ---- */
  if (!customer) {
    const tab = (m, t) => (
      <button type="button" onClick={() => { setMode(m); setError(''); setSubmitted(false); setTouched({}); }} style={{ flex: 1, padding: '12px 0', cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${mode === m ? 'var(--brand-royal)' : 'var(--border)'}`, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: mode === m ? 'var(--ink)' : 'var(--text-muted)' }}>{t}</button>
    );
    const fld = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };
    const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
    return (
      <div data-screen-label="Account" style={{ maxWidth: 460, margin: '0 auto', padding: '56px 24px 90px' }}>
        <div data-rise style={{ textAlign: 'center', marginBottom: 24 }}>
          <Eyebrow color="royal" rule>Members</Eyebrow>
          <h1 style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,5vw,50px)', textTransform: 'uppercase', color: 'var(--ink)' }}>{mode === 'register' ? 'Create your account' : 'Welcome Back'}</h1>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--white)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex' }}>{tab('login', 'Sign In')}{tab('register', 'Create Account')}</div>
          <form onSubmit={submitAuth} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px' }}>
            {mode === 'register' && (
              // minmax(0,1fr): a bare 1fr lets the inputs' intrinsic width push the second
              // column out of the card (support #218).
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                <div style={fld}><span style={lbl}>First name</span><Input autoComplete="given-name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div style={fld}><span style={lbl}>Last name</span><Input autoComplete="family-name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
            )}
            <div style={fld}>
              <span style={lbl}>Email</span>
              <Input type="email" autoComplete="email" value={form.email} invalid={!!showAuthErr('email')} aria-invalid={!!showAuthErr('email')} onBlur={blur('email')} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {showAuthErr('email') && <p role="alert" style={fieldErr}>{authErrors.email}</p>}
            </div>
            <div style={fld}>
              <span style={lbl}>Password</span>
              <Input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} invalid={!!showAuthErr('password')} aria-invalid={!!showAuthErr('password')} onBlur={blur('password')} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {showAuthErr('password') && <p role="alert" style={fieldErr}>{authErrors.password}</p>}
              {mode === 'register' && !showAuthErr('password') && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>At least 8 characters.</span>}
            </div>
            {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5, lineHeight: 1.5 }}>{error}</p>}
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
        <div style={{ ...card, minWidth: 0 }}>
          <h2 style={cardHead}>Profile</h2>
          <div style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>
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
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Order #{o.display_id}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString() : ''} · {(o.items || []).reduce((t, it) => t + (it.quantity || 0), 0)} item(s)
                    {o.status ? <> · <span style={{ textTransform: 'capitalize' }}>{String(o.status).replace(/_/g, ' ')}</span></> : null}
                    {o.tracking_url ? <> · <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>Track package</a></> : null}
                  </div>
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

        {addrError && <p role="alert" style={{ margin: '0 0 14px', color: 'var(--danger)', fontSize: 13.5, lineHeight: 1.5 }}>{addrError}</p>}

        {editing !== null ? (
          <div>
            <AddressForm value={formAddr} onChange={setFormAddr} showErrors={showAddrErrors} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={saveAddress} disabled={busy}>{busy ? 'Saving…' : 'Save address'}</Button>
              <Button variant="outline" onClick={() => { setEditing(null); setAddrError(''); }}>Cancel</Button>
            </div>
          </div>
        ) : addresses.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>No saved addresses yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(260px,100%),1fr))', gap: 14 }}>
            {addresses.map((a) => (
              <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{[a.first_name, a.last_name].filter(Boolean).join(' ') || 'Saved address'}</strong>
                  {a.is_default && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-royal)', background: 'var(--royal-100)', padding: '2px 7px', borderRadius: 3 }}>Default</span>}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-body)', margin: '6px 0 12px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{oneLineAddress(a)}</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12.5, flexWrap: 'wrap' }}>
                  <button onClick={() => startEdit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', padding: 0 }}>Edit</button>
                  {!a.is_default && <button onClick={() => makeDefault(a.id)} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', padding: 0 }}>Make default</button>}
                  <button onClick={() => removeAddress(a.id)} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-red)', padding: 0 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
