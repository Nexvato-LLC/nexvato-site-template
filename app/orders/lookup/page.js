'use client';

import { useState } from 'react';
import { lookupOrder } from '@/lib/shop';
import { EMAIL_RE } from '@/lib/validation';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import Input from '@/components/ds/Input';

const money = (n) => '$' + Number(n || 0).toFixed(2);
const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };

/**
 * Guest order lookup: the order number plus the email on the order.
 *
 * This is the safety net behind checkout. If an order takes a moment to confirm
 * after payment, or a shopper closes the tab before the confirmation appears,
 * this is how they find it again without an account.
 */
export default function OrderLookupPage() {
  useStorefrontMotion();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setOrder(null);
    if (!orderNumber.trim()) { setError('Enter your order number.'); return; }
    if (!EMAIL_RE.test(email.trim())) { setError('Enter the email address used for the order.'); return; }
    setBusy(true);
    try {
      setOrder(await lookupOrder(orderNumber.trim(), email.trim()));
    } catch (err) {
      // The API answers the same way for a wrong number and a wrong email, on purpose.
      setError(err.status === 404 ? 'We couldn’t find an order with those details. Check the order number and email and try again.' : err.message);
    } finally { setBusy(false); }
  };

  return (
    <div data-screen-label="Order lookup" style={{ maxWidth: 520, margin: '0 auto', padding: '56px 24px 90px' }}>
      <div data-rise style={{ textAlign: 'center', marginBottom: 24 }}>
        <Eyebrow color="royal" rule>Orders</Eyebrow>
        <h1 style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,5vw,48px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Track your order</h1>
      </div>
      <form onSubmit={submit} noValidate style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--white)', boxShadow: 'var(--shadow-sm)', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}><span style={lbl}>Order number</span><Input value={orderNumber} placeholder="e.g. 1001" onChange={(e) => setOrderNumber(e.target.value)} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}><span style={lbl}>Email</span><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5, lineHeight: 1.5 }}>{error}</p>}
        <Button type="submit" variant="primary" size="lg" fullWidth arrow={!busy} disabled={busy}>{busy ? 'Looking…' : 'Find my order'}</Button>
      </form>

      {order && (
        <div role="status" style={{ marginTop: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--white)', padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <strong style={{ color: 'var(--ink)' }}>Order #{order.display_id}</strong>
            <span style={{ textTransform: 'capitalize', color: 'var(--text-body)' }}>{String(order.status || '').replace(/_/g, ' ')}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>{order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}</div>
          {order.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 14, color: 'var(--text-body)' }}>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{it.title}{it.variant ? ` — ${it.variant}` : ''} × {it.quantity}</span>
              <span>{money(it.total)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4, fontWeight: 700, color: 'var(--ink)' }}><span>Total</span><span>{money(order.total)}</span></div>
          {order.tracking_url && <p style={{ margin: '12px 0 0', fontSize: 14 }}><a href={order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>Track your package{order.tracking_number ? ` (${order.tracking_number})` : ''}</a></p>}
        </div>
      )}
    </div>
  );
}
