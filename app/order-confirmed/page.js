'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Button from '@/components/ds/Button';
import { ORDER_EMAILS_ENABLED, readConfirmedOrder } from '@/lib/order-confirmation';

const money = (n) => '$' + Number(n || 0).toFixed(2);

/**
 * The thank-you page. Checkout hands over the confirmed order in sessionStorage
 * (lib/order-confirmation.js); a visit without one (a bookmark, another tab, a
 * closed-and-reopened browser) gets the way to find an order instead.
 */
export default function OrderConfirmedPage() {
  useStorefrontMotion();
  const router = useRouter();
  const { customer } = useAuth();
  // undefined until read: sessionStorage only exists in the browser.
  const [order, setOrder] = useState(undefined);
  useEffect(() => { setOrder(readConfirmedOrder()); }, []);

  if (order === undefined) return <div style={{ minHeight: '50vh' }} />;

  if (!order) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '90px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 40, textTransform: 'uppercase', color: 'var(--ink)' }}>Looking for your order?</h1>
        <p style={{ margin: '12px 0 22px', color: 'var(--text-muted)', lineHeight: 1.7 }}>Look it up with your order number and the email you checked out with.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="primary" size="lg" onClick={() => router.push('/orders/lookup')}>Look up an order</Button>
          <Button variant="outline" size="lg" onClick={() => router.push('/shop')}>Keep Shopping</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
      <div style={{ width: 82, height: 82, margin: '0 auto 20px', borderRadius: '50%', background: 'var(--brand-navy)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-md)' }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,56px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Order Confirmed</h1>
      <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>
        {/* Only promise a receipt when order emails are actually configured
            (backend RESEND_API_KEY + this flag). Claiming an email that no
            system sends is the one thing this screen must never do. */}
        Thank you! Your order <strong style={{ color: 'var(--brand-royal)' }}>#{order.display_id}</strong> is confirmed
        {ORDER_EMAILS_ENABLED && order.email
          ? <> and a receipt is on its way to <strong>{order.email}</strong>.</>
          : <>. Please save this order number — keep it handy if you need to contact us about your order.</>}
      </p>
      {order.items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '28px auto 0', padding: '16px 20px', maxWidth: 480, textAlign: 'left', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--white)' }}>
          {order.items.map((i, n) => (
            <li key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', fontSize: 14.5, color: 'var(--text-body)' }}>
              <span>{i.title}{i.variant ? ` · ${i.variant}` : ''}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</span>
              <span>{money(i.total)}</span>
            </li>
          ))}
          <li style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0 4px', marginTop: 4, borderTop: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-strong)' }}>
            <span>Total</span><span>{money(order.total)}</span>
          </li>
        </ul>
      )}
      <div style={{ marginTop: 26, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {customer && <Button variant="navy" size="lg" onClick={() => router.push('/account')}>View My Orders</Button>}
        <Button variant="primary" size="lg" arrow onClick={() => router.push('/shop')}>Keep Shopping</Button>
      </div>
    </div>
  );
}
