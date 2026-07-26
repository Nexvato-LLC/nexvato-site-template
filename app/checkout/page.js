'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateCartDetails, createPaymentIntent, completeOrder,
  retrieveCustomer, createCustomerAddress,
} from '@/lib/shop';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import Input from '@/components/ds/Input';
import AddressForm, { EMPTY_ADDRESS, toShippingAddress, isAddressComplete } from '@/components/AddressForm';
import StripePaymentSection, { stripeEnabled } from '@/components/StripePaymentSection';

const money = (n) => '$' + Number(n || 0).toFixed(2);
const EMAIL_RE = /.+@.+\..+/;


// Mirrors the backend's RESEND_API_KEY. Drives the confirmation copy so we never
// promise a receipt the backend isn't configured to send. Keep the two in sync
// (both are set together when provisioning an instance).
const ORDER_EMAILS_ENABLED = process.env.NEXT_PUBLIC_ORDER_EMAILS === 'true';

/** The Shop engine returns the client secret directly. */
function findClientSecret(payload) {
  return payload?.clientSecret ?? null;
}
const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };
const oneLine = (a) => [a.address_1, a.city, a.province, a.postal_code].filter(Boolean).join(', ');

export default function CheckoutPage() {
  useStorefrontMotion();
  const router = useRouter();
  const { cartId, cart, items, subtotal, catalogLoading, refreshCart, clear } = useCart();
  const { customer, login, register, logout } = useAuth();

  // account step (guest branch)
  const [guestChoice, setGuestChoice] = useState('guest'); // guest | signin | register
  const [si, setSi] = useState({ email: '', password: '' });
  const [rg, setRg] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');

  // address
  const [email, setEmail] = useState('');
  const [addr, setAddr] = useState(EMPTY_ADDRESS);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState('new');
  const [saveNew, setSaveNew] = useState(true);

  // delivery / order
  const [options, setOptions] = useState([]);
  const [optionId, setOptionId] = useState('');
  const [optsErr, setOptsErr] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const optsFor = useRef(null);

  // Stripe payment state. clientSecret drives the Payment Element; confirmRef
  // holds the confirm() the element hands back so the existing Place Order
  // button stays the single primary action.
  const [clientSecret, setClientSecret] = useState('');
  const [payErr, setPayErr] = useState('');
  const confirmRef = useRef(null);
  const onStripeReady = useCallback((fn) => { confirmRef.current = fn; }, []);
  const sessionFor = useRef(null);

  // delivery options for the cart (retryable — a failed fetch shows an error + Try again)
  const loadOptions = useCallback(() => {
    if (!cartId) return;
    setOptsErr(false);
    // The Shop engine applies the merchant's own shipping rules (flat rate +
    // free-shipping threshold) server-side, so there is no per-cart option
    // list to fetch. One standard option keeps the existing UI intact.
    Promise.resolve({ shipping_options: [{ id: 'standard', name: 'Standard shipping', amount: 0 }] })
      .then(({ shipping_options }) => {
        const o = shipping_options || [];
        setOptions(o);
        if (o[0]) setOptionId(o[0].id);
        if (o.length === 0) setOptsErr(true);
      })
      .catch(() => { setOptions([]); setOptsErr(true); });
  }, [cartId]);

  useEffect(() => {
    if (!cartId || optsFor.current === cartId) return;
    optsFor.current = cartId;
    loadOptions();
  }, [cartId, loadOptions]);

  // when signed in: prefill email + load saved addresses
  useEffect(() => {
    if (!customer) { setAddresses([]); setSelectedAddrId('new'); return; }
    setEmail(customer.email || '');
    retrieveCustomer().then((c) => ({ addresses: c?.addresses || [] }))
      .then(({ addresses: list }) => {
        const a = list || [];
        setAddresses(a);
        const def = a.find((x) => x.isDefault) || a[0];
        setSelectedAddrId(def ? def.id : 'new');
      })
      .catch(() => { setAddresses([]); setSelectedAddrId('new'); });
  }, [customer]);

  const usingSaved = customer && selectedAddrId !== 'new';
  const chosenAddress = usingSaved ? (addresses.find((a) => a.id === selectedAddrId) || EMPTY_ADDRESS) : addr;
  const effectiveEmail = customer ? customer.email : email;

  // Money is authoritative from the SERVER: the engine recomputes tax and
  // shipping on every cart change, so the summary shows its numbers rather
  // than a client-side guess that could disagree with the actual charge.
  const shipping = (cart?.shippingCents ?? 0) / 100;
  const tax = (cart?.taxCents ?? 0) / 100;
  const total = cart?.totalCents != null ? cart.totalCents / 100 : subtotal + shipping + tax;
  const emailOk = EMAIL_RE.test(effectiveEmail || '');
  const valid = emailOk && isAddressComplete(chosenAddress) && !!optionId && items.length > 0;

  const doSignin = async (e) => {
    e?.preventDefault();
    setAuthBusy(true); setAuthErr('');
    try { await login(si.email, si.password); } catch { setAuthErr('Invalid email or password.'); } finally { setAuthBusy(false); }
  };
  const doRegister = async (e) => {
    e?.preventDefault();
    setAuthBusy(true); setAuthErr('');
    try { await register(rg); } catch { setAuthErr('Could not create that account — the email may already be registered.'); } finally { setAuthBusy(false); }
  };

  // Push the final email/address/shipping onto the cart. Shared by the payment-
  // session effect and placeOrder so the amount Stripe authorizes always matches
  // the total shown in the summary.
  const syncCart = useCallback(async () => {
    const shippingAddr = toShippingAddress(chosenAddress);
    await updateCartDetails(cartId, {
      email: effectiveEmail,
      shippingAddress: {
        firstName: shippingAddr.first_name, lastName: shippingAddr.last_name,
        line1: shippingAddr.address_1, line2: shippingAddr.address_2,
        city: shippingAddr.city, province: shippingAddr.province,
        postalCode: shippingAddr.postal_code, country: shippingAddr.country_code,
        phone: shippingAddr.phone,
      },
    });
    return (await refreshCart(cartId)) || cart;
  }, [cartId, cart, chosenAddress, effectiveEmail, optionId, refreshCart]);

  // Create (or refresh) the Stripe payment session once the rest of the order is
  // valid. Re-runs whenever the TOTAL changes — switching shipping option changes
  // the amount, and a stale PaymentIntent would charge the wrong number.
  useEffect(() => {
    if (!stripeEnabled || !cartId || !valid || order) return;
    const key = `${cartId}:${total.toFixed(2)}`;
    if (sessionFor.current === key) return;
    let cancelled = false;
    (async () => {
      try {
        setPayErr('');
        const fresh = await syncCart();
        const res = await createPaymentIntent(cartId);
        const secret = findClientSecret(res);
        if (cancelled) return;
        if (!secret) {
          // Provider linked to the region but not actually registered (e.g. the
          // backend's STRIPE_API_KEY was removed) — say so instead of showing
          // card fields that cannot charge.
          setPayErr('Card payment is temporarily unavailable. Please try again later.');
          return;
        }
        sessionFor.current = key;
        setClientSecret(secret);
      } catch {
        if (!cancelled) setPayErr('We could not start a secure payment session. Please refresh and try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [cartId, valid, total, order, syncCart]);

  // Return leg for redirect-based methods (Klarna, Affirm): Stripe sends the
  // customer back here with the outcome in the query string. Finish the order.
  const redirectHandled = useRef(false);
  useEffect(() => {
    if (!stripeEnabled || redirectHandled.current || !cartId || order) return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('redirect_status');
    if (!status) return;
    redirectHandled.current = true;
    // Strip the params so a refresh can't replay this.
    window.history.replaceState({}, '', window.location.pathname);
    if (status !== 'succeeded') {
      setError('Your payment was not completed. Please try again.');
      return;
    }
    (async () => {
      setProcessing(true);
      try {
        const res = { type: 'order', order: await completeOrder(cartId) };
        if (res.type === 'order') { setOrder(res.order); clear(); }
        else setError(res.error?.message || 'Your payment went through but we could not finish the order. Please contact us.');
      } catch (e) {
        setError(e?.message || 'Your payment went through but we could not finish the order. Please contact us.');
      } finally { setProcessing(false); }
    })();
  }, [cartId, order, clear]);

  const placeOrder = async () => {
    if (!valid || processing) return;
    setProcessing(true); setError('');
    try {
      if (customer && !usingSaved && saveNew && isAddressComplete(addr)) {
        try {
          const a = toShippingAddress(addr);
          await createCustomerAddress({
            firstName: a.first_name, lastName: a.last_name, line1: a.address_1,
            line2: a.address_2, city: a.city, province: a.province,
            postalCode: a.postal_code, country: (a.country_code || 'us'), phone: a.phone,
          });
        } catch (e) { /* non-fatal */ }
      }
      const fresh = await syncCart();

      if (stripeEnabled) {
        if (!confirmRef.current) {
          setError('The payment form is still loading — give it a moment and try again.');
          return;
        }
        const { error: stripeError, paymentIntent } = await confirmRef.current(`${window.location.origin}/checkout`);
        if (stripeError) {
          // Card declined / validation failure. Never fall through to complete().
          setError(stripeError.message || 'Your payment could not be processed.');
          return;
        }
        // Redirect-based method: the browser is navigating to the provider, and
        // the return-leg effect above finishes the order when it comes back.
        if (!paymentIntent) return;
        // `processing` is legitimate for async methods — Stripe's webhook
        // settles it; the order is created now and updated on capture.
        if (!['succeeded', 'requires_capture', 'processing'].includes(paymentIntent.status)) {
          setError('Your payment was not completed. Please try again.');
          return;
        }
      } else {
        // No Stripe configured: Medusa's manual provider. No card is charged,
        // and the UI says exactly that.
        // No manual-payment path on this engine: an order that never started
        // payment is refused at completion (402), by design.
      }

      const res = { type: 'order', order: await completeOrder(cartId) };
      if (res.type === 'order') { setOrder(res.order); clear(); }
      else setError(res.error?.message || 'We could not complete your order. Please review your details and try again.');
    } catch (e) {
      setError(e?.message || 'Something went wrong at checkout.');
    } finally { setProcessing(false); }
  };

  /* ---- Confirmation ---- */
  if (order) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
        <div style={{ width: 82, height: 82, margin: '0 auto 20px', borderRadius: '50%', background: 'var(--brand-navy)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-md)' }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,56px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Order Confirmed</h1>
        <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)' }}>
          {/* Only promise a receipt when order emails are actually configured
              (backend RESEND_API_KEY + this flag). Claiming an email that no
              system sends is the one thing this screen must never do. */}
          Thank you! Your order <strong style={{ color: 'var(--brand-royal)' }}>#{order.display_id}</strong> is confirmed
          {ORDER_EMAILS_ENABLED
            ? <> and a receipt is on its way to <strong>{order.email}</strong>.</>
            : <>. Please save this order number — keep it handy if you need to contact us about your order.</>}
          
        </p>
        <div style={{ marginTop: 26, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {customer && <Button variant="navy" size="lg" onClick={() => router.push('/account')}>View My Orders</Button>}
          <Button variant="primary" size="lg" arrow onClick={() => router.push('/shop')}>Keep Shopping</Button>
        </div>
      </div>
    );
  }

  /* ---- Empty cart ---- */
  if (!catalogLoading && (!cartId || items.length === 0)) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '90px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 40, textTransform: 'uppercase', color: 'var(--ink)' }}>Your cart is empty</h1>
        <p style={{ margin: '12px 0 22px', color: 'var(--text-muted)' }}>Add some gear before checking out.</p>
        <Button variant="primary" size="lg" arrow onClick={() => router.push('/shop')}>Shop the Collection</Button>
      </div>
    );
  }

  const stepHead = (n, t) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-navy)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>{n}</span>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink)' }}>{t}</h2>
    </div>
  );
  const segBtn = (k, text) => (
    <button type="button" onClick={() => { setGuestChoice(k); setAuthErr(''); }} style={{ flex: 1, padding: '10px 8px', cursor: 'pointer', border: '1px solid var(--border-strong)', background: guestChoice === k ? 'var(--brand-navy)' : 'var(--white)', color: guestChoice === k ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{text}</button>
  );

  return (
    <div data-screen-label="Checkout" style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div data-rise>
        <Eyebrow color="royal" rule>Secure Checkout</Eyebrow>
        <h1 style={{ margin: '10px 0 28px', fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,4.6vw,54px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Checkout</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px,100%),1fr))', gap: 40, alignItems: 'start' }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
          {/* 1. Account */}
          <section>
            {stepHead(1, 'Account')}
            {customer ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--gray-100)' }}>
                <span style={{ fontSize: 14, color: 'var(--text-body)' }}>Signed in as <strong style={{ color: 'var(--ink)' }}>{customer.email}</strong></span>
                <button type="button" onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', fontSize: 13, textDecoration: 'underline' }}>Not you? Sign out</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {segBtn('guest', 'Guest')}{segBtn('signin', 'Sign in')}{segBtn('register', 'Create account')}
                </div>
                {guestChoice === 'guest' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={lbl}>Email</span>
                    <Input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>We&rsquo;ll send your receipt here. Create an account below to track orders.</span>
                  </div>
                )}
                {guestChoice === 'signin' && (
                  <form onSubmit={doSignin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={lbl}>Email</span><Input type="email" value={si.email} onChange={(e) => setSi({ ...si, email: e.target.value })} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={lbl}>Password</span><Input type="password" value={si.password} onChange={(e) => setSi({ ...si, password: e.target.value })} /></div>
                    {authErr && <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5 }}>{authErr}</p>}
                    <Button type="submit" variant="navy" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign In'}</Button>
                  </form>
                )}
                {guestChoice === 'register' && (
                  <form onSubmit={doRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={lbl}>First name</span><Input value={rg.first_name} onChange={(e) => setRg({ ...rg, first_name: e.target.value })} /></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={lbl}>Last name</span><Input value={rg.last_name} onChange={(e) => setRg({ ...rg, last_name: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={lbl}>Email</span><Input type="email" value={rg.email} onChange={(e) => setRg({ ...rg, email: e.target.value })} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={lbl}>Password</span><Input type="password" value={rg.password} onChange={(e) => setRg({ ...rg, password: e.target.value })} /></div>
                    {authErr && <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5 }}>{authErr}</p>}
                    <Button type="submit" variant="navy" disabled={authBusy}>{authBusy ? 'Creating…' : 'Create Account'}</Button>
                  </form>
                )}
              </div>
            )}
          </section>

          {/* 2. Shipping address */}
          <section>
            {stepHead(2, 'Shipping address')}
            {customer && addresses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: usingSaved ? 0 : 16 }}>
                {addresses.map((a) => (
                  <label key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', cursor: 'pointer', border: `1px solid ${selectedAddrId === a.id ? 'var(--brand-royal)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', background: selectedAddrId === a.id ? 'var(--royal-100)' : 'var(--white)' }}>
                    <input type="radio" name="addr" checked={selectedAddrId === a.id} onChange={() => setSelectedAddrId(a.id)} />
                    <span style={{ fontSize: 13.5, color: 'var(--text-body)' }}><strong style={{ color: 'var(--text-strong)' }}>{a.first_name} {a.last_name}</strong> — {oneLine(a)}</span>
                  </label>
                ))}
                <label style={{ display: 'flex', gap: 12, padding: '12px 14px', cursor: 'pointer', border: `1px solid ${selectedAddrId === 'new' ? 'var(--brand-royal)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', background: selectedAddrId === 'new' ? 'var(--royal-100)' : 'var(--white)' }}>
                  <input type="radio" name="addr" checked={selectedAddrId === 'new'} onChange={() => setSelectedAddrId('new')} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>Use a new address</span>
                </label>
              </div>
            )}
            {!usingSaved && (
              <>
                <AddressForm value={addr} onChange={setAddr} />
                {customer && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13.5, color: 'var(--text-body)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} /> Save this address to my account
                  </label>
                )}
              </>
            )}
          </section>

          {/* 3. Delivery */}
          <section>
            {stepHead(3, 'Delivery')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {options.length === 0 && !optsErr && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Loading delivery options…</p>}
              {optsErr && (
                <div style={{ padding: '12px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--text-body)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span>We couldn&rsquo;t load delivery options.</span>
                  <button type="button" onClick={loadOptions} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', fontWeight: 700, textDecoration: 'underline', fontSize: 13.5 }}>Try again</button>
                </div>
              )}
              {options.map((o) => (
                <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', border: `1px solid ${optionId === o.id ? 'var(--brand-royal)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', background: optionId === o.id ? 'var(--royal-100)' : 'var(--white)' }}>
                  <input type="radio" name="ship" checked={optionId === o.id} onChange={() => setOptionId(o.id)} />
                  <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-strong)' }}>{o.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{money(o.amount)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* 4. Payment */}
          <section>
            {stepHead(4, 'Payment')}
            {!stripeEnabled ? (
              <div style={{ padding: '14px 16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Demonstration storefront — orders are placed through Medusa&rsquo;s manual payment provider and <strong>no card is charged</strong>.
              </div>
            ) : payErr ? (
              <div style={{ padding: '14px 16px', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--danger)', lineHeight: 1.6 }}>
                {payErr}
              </div>
            ) : !valid ? (
              <div style={{ padding: '14px 16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Complete the steps above and your payment options will appear here.
              </div>
            ) : !clientSecret ? (
              <div style={{ padding: '14px 16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Loading secure payment…
              </div>
            ) : (
              <StripePaymentSection clientSecret={clientSecret} onReady={onStripeReady} />
            )}
          </section>
        </div>

        {/* Summary */}
        <div style={{ position: 'sticky', top: 100, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '22px 22px 24px', background: 'var(--white)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)' }}>Order summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
            {items.map((it) => (
              <div key={it.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div role="img" aria-label={it.title} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 4, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${it.image || ''}")` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty {it.qty}</div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{money(it.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--text-body)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Shipping</span><span>{shipping ? money(shipping) : '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, color: 'var(--ink)', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}><span>Total</span><span>{money(total)}</span></div>
          </div>
          {error && <p style={{ margin: '14px 0 0', color: 'var(--danger)', fontSize: 13.5 }}>{error}</p>}
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" size="lg" fullWidth arrow={!processing} disabled={!valid || processing} onClick={placeOrder}>
              {processing ? 'Placing order…' : `Place Order · ${money(total)}`}
            </Button>
          </div>
          {!valid && !processing && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
              {items.length === 0
                ? 'Your cart is empty.'
                : !emailOk
                  ? 'Enter a valid email to continue.'
                  : !isAddressComplete(chosenAddress)
                    ? 'Complete your shipping address to continue.'
                    : !optionId
                      ? 'Select a delivery option to continue.'
                      : ''}
            </p>
          )}
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Free U.S. shipping over $75 · Ships from Springfield, USA</p>
        </div>
      </div>
    </div>
  );
}
