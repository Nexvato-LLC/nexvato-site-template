'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateCartDetails, createPaymentIntent, completeOrder, restartCheckout,
  retrieveCustomer, createCustomerAddress, shopErrorMessage,
} from '@/lib/shop';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useShopConfig } from '@/components/ShopConfigProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import Input from '@/components/ds/Input';
import AddressForm, { EMPTY_ADDRESS, toShippingAddress, isAddressComplete } from '@/components/AddressForm';
import StripePaymentSection from '@/components/StripePaymentSection';
import DiscountCodeForm from '@/components/DiscountCodeForm';
import { formatCents } from '@/lib/shipping';

/*
 * Checkout (support #134 / #135).
 *
 * MONEY IS THE SERVER'S. Every amount on this page — line totals, subtotal,
 * discounts, tax, shipping, total — is the server cart's integer cents. The
 * page used to show a hardcoded "$0.00 Standard shipping" option and leave tax
 * out of the summary, so a $48.20 order read as $40 + $0 (#134). Delivery and
 * the summary now show the same server shipping figure, and zero is shown as
 * $0.00 rather than hidden.
 *
 * PAYMENT READINESS IS READ, NOT ASSUMED (#135). Whether the store can take a
 * payment — and the Stripe key to take it with — comes from the store's
 * settings at runtime (`acceptingPayments`, `publishableKey`). When it cannot,
 * the page says so BEFORE asking for an address. A key baked into the build is
 * never used: it went stale and could switch on a card form for a store that
 * cannot charge. Readiness is re-read before preparing and before confirming
 * a payment; the server's own guards stay authoritative.
 *
 * ONE EXPLICIT STEP AT A TIME. "Continue to payment" saves the details and
 * prepares the payment; "Place Order" confirms it. The page used to prepare
 * the payment by itself whenever the form looked complete, in an effect that
 * re-ran on every cart refresh it caused — hundreds of cart updates and
 * payment requests a second, ending in a frozen-checkout error. Preparing
 * freezes the order's details on the server, so changing them afterwards goes
 * through "Change details", which cancels the prepared payment.
 *
 * A DECLINE NEVER COMPLETES AN ORDER. Only a succeeded payment reaches order
 * confirmation. An attempt whose outcome is unknown is reconciled by reading
 * the payment, never by confirming it again, and a confirmation the server
 * has not caught up with yet is retried without charging again.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Mirrors whether the store sends order emails. Drives the confirmation copy
// so we never promise a receipt that nothing sends.
const ORDER_EMAILS_ENABLED = process.env.NEXT_PUBLIC_ORDER_EMAILS === 'true';

const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };
const noticeBox = { padding: '14px 16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 };
const alertBox = { padding: '14px 16px', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--danger)', lineHeight: 1.6 };

/** 'ready' | 'unavailable' from a settings answer; 'unknown' when it could not be read. */
function readinessOf(config) {
  if (!config) return 'unknown';
  return config.acceptingPayments && config.publishableKey ? 'ready' : 'unavailable';
}

/** A saved customer address (API, camelCase) in the form's shape. */
function fromSavedAddress(a = {}) {
  return {
    first_name: a.firstName || '', last_name: a.lastName || '', address_1: a.line1 || '',
    city: a.city || '', province: a.province || '', postal_code: a.postalCode || '', phone: a.phone || '',
  };
}
const oneLine = (a) => [a.line1, a.city, a.province, a.postalCode].filter(Boolean).join(', ');

export default function CheckoutPage() {
  useStorefrontMotion();
  const router = useRouter();
  const { cartId, cart, cartReady, items, refreshCart, adoptCart, clear } = useCart();
  const { customer, login, register, logout } = useAuth();
  const { config, refreshConfig } = useShopConfig();

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

  // payment readiness + flow
  const [readiness, setReadiness] = useState(() => (config ? readinessOf(config) : 'checking'));
  const [step, setStep] = useState('details'); // details | payment
  const [clientSecret, setClientSecret] = useState('');
  const [payKey, setPayKey] = useState('');
  const [reviewedDue, setReviewedDue] = useState(null);
  const [paymentSent, setPaymentSent] = useState(false);      // confirm() was called; outcome may be unknown
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState(null);
  const payment = useRef(null);
  const onPaymentReady = useCallback((p) => { payment.current = p; }, []);
  const hydratedFor = useRef(null);

  // Re-read readiness on arrival: the first render used the settings from the
  // page load, which may be older than this visit to checkout.
  const checkReadiness = useCallback(async () => {
    const fresh = await refreshConfig();
    setReadiness(readinessOf(fresh));
    return fresh;
  }, [refreshConfig]);
  useEffect(() => { checkReadiness(); }, [checkReadiness]);

  // Prefill from what the cart already holds — a refreshed checkout whose
  // payment was prepared comes back with its details (and stays frozen).
  useEffect(() => {
    if (!cart?.id || hydratedFor.current === cart.id) return;
    hydratedFor.current = cart.id;
    if (cart.contactEmail) setEmail(cart.contactEmail);
    const a = cart.shippingAddress;
    if (a && typeof a === 'object') setAddr({ ...EMPTY_ADDRESS, ...fromSavedAddress(a) });
  }, [cart]);

  // when signed in: prefill email + load saved addresses
  useEffect(() => {
    if (!customer) { setAddresses([]); setSelectedAddrId('new'); return; }
    setEmail(customer.email || '');
    retrieveCustomer()
      .then((c) => {
        const list = c?.addresses || [];
        setAddresses(list);
        const def = list.find((x) => x.isDefault) || list[0];
        setSelectedAddrId(def ? def.id : 'new');
      })
      .catch(() => { setAddresses([]); setSelectedAddrId('new'); });
  }, [customer]);

  const frozen = cart?.status === 'pending_payment';
  const locked = frozen || step === 'payment' || busy;
  const usingSaved = customer && selectedAddrId !== 'new';
  const chosenAddress = usingSaved ? fromSavedAddress(addresses.find((a) => a.id === selectedAddrId)) : addr;
  const effectiveEmail = customer ? customer.email : email;
  const emailOk = EMAIL_RE.test((effectiveEmail || '').trim());
  const valid = emailOk && isAddressComplete(chosenAddress) && items.length > 0;
  const currency = cart?.currency || config?.currency || 'usd';
  const money = (cents) => formatCents(cents, currency);
  const due = cart ? (cart.amountDueCents ?? cart.totalCents) : 0;
  const deliveryStatus = cart?.deliveryQuote?.status;

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

  const backToDetails = (message) => {
    setStep('details'); setClientSecret(''); setReviewedDue(null);
    payment.current = null;
    if (message) setError(message);
  };

  /** "Continue to payment": save details, prepare ONE payment, review its amount. */
  const continueToPayment = async () => {
    if (busy || !cartId || !valid) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const fresh = await checkReadiness();
      if (readinessOf(fresh) !== 'ready') return;
      if (!frozen) {
        if (customer && !usingSaved && saveNew && isAddressComplete(addr)) {
          try {
            const a = toShippingAddress(addr);
            await createCustomerAddress({
              firstName: a.first_name, lastName: a.last_name, line1: a.address_1, city: a.city,
              province: a.province, postalCode: a.postal_code, country: a.country_code || 'us', phone: a.phone,
            });
          } catch { /* saving to the address book is optional */ }
        }
        const a = toShippingAddress(chosenAddress);
        await updateCartDetails(cartId, {
          email: effectiveEmail.trim(),
          shippingAddress: {
            firstName: a.first_name, lastName: a.last_name, line1: a.address_1,
            city: a.city, province: a.province, postalCode: a.postal_code,
            country: a.country_code, phone: a.phone,
          },
        });
      }
      // The amount comes from the recalculated order, never from this page.
      const { clientSecret: secret, amountCents } = await createPaymentIntent(cartId);
      const latest = await refreshCart(cartId);
      if (!secret || !latest) throw new Error('We could not prepare your payment. Please try again.');
      const latestDue = latest.amountDueCents ?? latest.totalCents;
      if (amountCents !== latestDue) {
        setError(`Your total changed to ${money(latestDue)}. Review your order, then continue to payment again.`);
        return;
      }
      setPayKey(fresh.publishableKey);
      setReviewedDue(latestDue);
      setClientSecret(secret);
      setStep('payment');
    } catch (e) {
      setError(shopErrorMessage(e));
      await refreshCart(cartId);
    } finally {
      setBusy(false);
    }
  };

  /** "Change details" after payment was prepared: cancel it and edit a copy. */
  const changeDetails = async () => {
    if (busy || !cartId || paymentSent || paymentSucceeded) return;
    if (!confirmRestart) { setConfirmRestart(true); return; }
    setBusy(true); setError('');
    try {
      const next = await restartCheckout(cartId);
      adoptCart(next);
      hydratedFor.current = null;
      backToDetails();
      setConfirmRestart(false);
      setNotice('Your previous payment attempt was canceled. Review your details and the updated total before paying.');
    } catch (e) {
      setError(shopErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Order confirmation after a SUCCEEDED payment. Retries; never pays again. */
  const finishOrder = useCallback(async (id) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const placed = await completeOrder(id);
        setOrder(placed);
        clear();
        return true;
      } catch (e) {
        // The payment webhook may not have landed yet.
        if (e?.code === 'PAYMENT_REQUIRED' && attempt < 3) { await sleep(1500 * (attempt + 1)); continue; }
        setError(e?.code === 'PAYMENT_REQUIRED'
          ? 'Your payment went through. We are still confirming your order — check again in a moment. You will not be charged again.'
          : `Your payment went through, but the order could not be confirmed yet: ${shopErrorMessage(e)} You will not be charged again.`);
        return false;
      }
    }
  }, [clear]);

  /** "Place Order": confirm the prepared payment, then confirm the order. */
  const placeOrder = async () => {
    if (busy || !cartId || step !== 'payment') return;
    setBusy(true); setError('');
    try {
      if (!paymentSucceeded) {
        if (!payment.current) { setError('The payment form is still loading — give it a moment and try again.'); return; }
        if (!paymentSent) {
          // Readiness and the reviewed amount, once more, right before money moves.
          const fresh = await checkReadiness();
          if (readinessOf(fresh) !== 'ready' || fresh.publishableKey !== payKey) {
            backToDetails('Payment settings for this store changed. Review your order and continue to payment again.');
            return;
          }
          const latest = await refreshCart(cartId);
          if (!latest || (latest.amountDueCents ?? latest.totalCents) !== reviewedDue) {
            backToDetails('Your total changed. Review the updated order and continue to payment again.');
            return;
          }
        }
        setPaymentSent(true);
        const result = paymentSent
          ? await payment.current.retrieve()
          : await payment.current.confirm(`${window.location.origin}/checkout`);
        if (result?.error) {
          const status = result.error.payment_intent?.status;
          if (result.error.type === 'validation_error' || ['requires_payment_method', 'requires_confirmation', 'canceled'].includes(status)) setPaymentSent(false);
          // A decline is final for this attempt: never fall through to completion.
          setError(result.error.message || 'Your payment could not be processed.');
          return;
        }
        const pi = result?.paymentIntent;
        // Redirect-based method: the browser is leaving; the return leg finishes.
        if (!pi) return;
        if (['requires_payment_method', 'requires_confirmation', 'canceled'].includes(pi.status)) {
          setPaymentSent(false);
          setError('Your payment was not completed. Review your payment details and try again.');
          return;
        }
        if (pi.status !== 'succeeded') {
          setError('Your payment is still processing. Check its status again shortly.');
          return;
        }
        setPaymentSucceeded(true);
      }
      await finishOrder(cartId);
    } catch (e) {
      setError(shopErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Return leg for redirect-based methods (Klarna, Affirm): Stripe sends the
  // shopper back here with the outcome in the query string.
  const redirectHandled = useRef(false);
  useEffect(() => {
    if (redirectHandled.current || !cartReady || !cartId || order) return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('redirect_status');
    if (!status) return;
    redirectHandled.current = true;
    // Strip the params so a refresh can't replay this.
    window.history.replaceState(null, '', window.location.pathname);
    if (status !== 'succeeded') {
      setError('Your payment was not completed. Please try again.');
      return;
    }
    setPaymentSucceeded(true);
    setBusy(true);
    finishOrder(cartId).finally(() => setBusy(false));
  }, [cartReady, cartId, order, finishOrder]);

  /* ---- Confirmation ---- */
  if (order) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
        <div style={{ width: 82, height: 82, margin: '0 auto 20px', borderRadius: '50%', background: 'var(--brand-navy)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-md)' }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,56px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Order Confirmed</h1>
        <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)' }}>
          Thank you! Your order <strong style={{ color: 'var(--brand-royal)' }}>{order.orderNumber}</strong> is confirmed
          {ORDER_EMAILS_ENABLED && order.contactEmail
            ? <> and a receipt is on its way to <strong>{order.contactEmail}</strong>.</>
            : <>. Please save this order number — keep it handy if you need to contact us about your order.</>}
        </p>
        <div style={{ marginTop: 26, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {customer && <Button variant="navy" size="lg" onClick={() => router.push('/account')}>View My Orders</Button>}
          <Button variant="primary" size="lg" arrow onClick={() => router.push('/shop')}>Keep Shopping</Button>
        </div>
      </div>
    );
  }

  if (!cartReady) {
    return <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 13 }}>Loading…</div>;
  }

  /* ---- Empty cart ---- */
  if (!cartId || items.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '90px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 40, textTransform: 'uppercase', color: 'var(--ink)' }}>Your cart is empty</h1>
        <p style={{ margin: '12px 0 22px', color: 'var(--text-muted)' }}>Add something from the shop before checking out.</p>
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

  const canCheckout = readiness === 'ready';
  const shippingLabel = deliveryStatus === 'needs_address' ? 'Calculated after address'
    : deliveryStatus === 'unavailable' ? 'Unavailable'
      : money(cart?.shippingCents ?? 0);
  const primaryLabel = step === 'payment'
    ? (busy ? 'Processing…' : paymentSucceeded ? 'Check order confirmation' : paymentSent ? 'Check payment status' : `Place Order · ${money(reviewedDue ?? due)}`)
    : (busy ? 'Preparing payment…' : 'Continue to payment');
  const primaryDisabled = !canCheckout || busy || (step === 'details' && !valid);
  const primaryAction = step === 'payment' ? placeOrder : continueToPayment;

  return (
    <div data-screen-label="Checkout" style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div data-rise>
        <Eyebrow color="royal" rule>Secure Checkout</Eyebrow>
        <h1 style={{ margin: '10px 0 28px', fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,4.6vw,54px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Checkout</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px,100%),1fr))', gap: 40, alignItems: 'start' }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, minWidth: 0 }}>
          {/* Payment readiness comes first: never collect an address for a
              checkout that cannot be paid for. */}
          {readiness === 'checking' && <div role="status" style={noticeBox}>Checking whether this store can take payment…</div>}
          {readiness === 'unavailable' && (
            <div role="alert" style={alertBox}>
              <strong>This store isn&rsquo;t taking online payments yet.</strong> Checkout is closed until the store finishes its payment setup. Your cart is saved.
            </div>
          )}
          {readiness === 'unknown' && (
            <div role="alert" style={{ ...alertBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>We couldn&rsquo;t check whether this store can take payment right now. Your cart is saved.</span>
              <Button variant="outline" size="sm" onClick={() => { setReadiness('checking'); checkReadiness(); }}>Try again</Button>
            </div>
          )}

          {canCheckout && (
            <>
              {notice && <div role="status" style={noticeBox}>{notice}</div>}
              {frozen && step === 'details' && (
                <div role="status" style={{ ...noticeBox, borderStyle: 'solid', color: 'var(--text-body)' }}>
                  Payment was prepared for this order, so its details are locked. Continue to payment to finish it, or change the details (this cancels the prepared payment).
                </div>
              )}

              {/* 1. Account */}
              <section>
                {stepHead(1, 'Account')}
                {customer ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--gray-100)' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>Signed in as <strong style={{ color: 'var(--ink)' }}>{customer.email}</strong></span>
                    {!locked && <button type="button" onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', fontSize: 13, textDecoration: 'underline' }}>Not you? Sign out</button>}
                  </div>
                ) : locked ? (
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>Email: <strong style={{ color: 'var(--ink)' }}>{email}</strong></p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      {segBtn('guest', 'Guest')}{segBtn('signin', 'Sign in')}{segBtn('register', 'Create account')}
                    </div>
                    {guestChoice === 'guest' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={lbl}>Email</span>
                        <Input type="email" aria-label="Email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Used for this order. Create an account to track your orders.</span>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(140px,100%),1fr))', gap: 12 }}>
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

              {/* 2. Shipping address — locked once payment is prepared */}
              <section>
                {stepHead(2, 'Shipping address')}
                <fieldset disabled={locked} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                  {customer && addresses.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: usingSaved ? 0 : 16 }}>
                      {addresses.map((a) => (
                        <label key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', cursor: 'pointer', border: `1px solid ${selectedAddrId === a.id ? 'var(--brand-royal)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', background: selectedAddrId === a.id ? 'var(--royal-100)' : 'var(--white)' }}>
                          <input type="radio" name="addr" checked={selectedAddrId === a.id} onChange={() => setSelectedAddrId(a.id)} />
                          <span style={{ fontSize: 13.5, color: 'var(--text-body)' }}><strong style={{ color: 'var(--text-strong)' }}>{a.firstName} {a.lastName}</strong> — {oneLine(a)}</span>
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
                </fieldset>
                {(frozen || step === 'payment') && !paymentSent && !paymentSucceeded && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {confirmRestart && <span style={{ fontSize: 13, color: 'var(--text-body)' }}>This cancels the prepared payment so you can edit your order.</span>}
                    <Button variant="outline" size="sm" disabled={busy} onClick={changeDetails}>{confirmRestart ? 'Yes, change details' : 'Change details'}</Button>
                    {confirmRestart && <button type="button" onClick={() => setConfirmRestart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', fontSize: 13, textDecoration: 'underline' }}>Keep my payment</button>}
                  </div>
                )}
              </section>

              {/* 3. Delivery — the server's shipping figure, same as the summary */}
              <section>
                {stepHead(3, 'Delivery')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--white)' }}>
                  <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-strong)' }}>Shipping</span>
                  <span data-testid="delivery-amount" style={{ fontWeight: 700, color: 'var(--ink)' }}>{shippingLabel}</span>
                </div>
                {deliveryStatus === 'unavailable' && cart.deliveryQuote?.message && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--danger)' }}>{cart.deliveryQuote.message}</p>}
                {step === 'details' && !frozen && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>Shipping is recalculated for your address when you continue to payment.</p>}
              </section>

              {/* 4. Payment */}
              <section>
                {stepHead(4, 'Payment')}
                {step === 'payment' && clientSecret ? (
                  <StripePaymentSection publishableKey={payKey} clientSecret={clientSecret} onReady={onPaymentReady} />
                ) : (
                  <div style={noticeBox}>Complete the steps above and choose Continue to payment. Payment options appear here.</div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Summary — every amount is the server cart's */}
        <div style={{ position: 'sticky', top: 100, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '22px 22px 24px', background: 'var(--white)', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)' }}>Order summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
            {items.map((it) => (
              <div key={it.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div role="img" aria-label={it.title} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 4, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${it.image || ''}")` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}{it.variant ? ` · ${it.variant}` : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty {it.qty}</div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{money(Math.round(it.lineTotal * 100))}</span>
              </div>
            ))}
          </div>
          {/* Support #143. Locked once payment is prepared: the server freezes
              the order's offers from then on. */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 0' }}>
            <DiscountCodeForm locked={frozen || step === 'payment'} />
          </div>
          <div data-testid="order-totals" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--text-body)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(cart?.subtotalCents ?? 0)}</span></div>
            {(cart?.discountCents ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: 600 }}><span>Discounts</span><span>&minus;{money(cart.discountCents)}</span></div>}
            {(cart?.promotions || []).map((p, i) => <div key={`${p.name}-${i}`} style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{p.name}: &minus;{money(p.discountCents)}</div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Shipping</span><span>{shippingLabel}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>{money(cart?.taxCents ?? 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, color: 'var(--ink)', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}><span>Total</span><span>{money(cart?.totalCents ?? 0)}</span></div>
            {(cart?.storedValueCents ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Remaining payment</span><span>{money(due)}</span></div>}
          </div>
          {(cart?.promotionMessages || []).map((m, i) => <p key={i} role="status" style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>{m}</p>)}
          {error && <p role="alert" style={{ margin: '14px 0 0', color: 'var(--danger)', fontSize: 13.5 }}>{error}</p>}
          {canCheckout && (
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" size="lg" fullWidth arrow={!busy} disabled={primaryDisabled} onClick={primaryAction}>{primaryLabel}</Button>
            </div>
          )}
          {canCheckout && step === 'details' && !valid && !busy && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
              {!emailOk ? 'Enter a valid email to continue.' : 'Complete your shipping address to continue.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
