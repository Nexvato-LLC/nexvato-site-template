'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateCartDetails, applyDiscountCode, createPaymentIntent, completeOrderWithRetry,
  placeZeroTotalOrder, placeStoredValueOrder, applyGiftCard, removeStoredValue, restartCheckout,
  retrieveCustomer, createCustomerAddress, cartAddressToApi, addressFromApi, cartSignature, GIFT_CODE_RE,
} from '@/lib/shop';
import { authErrorMessage, validateAuth } from '@/lib/auth-messages';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useShopConfig } from '@/components/ShopConfigProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import Input from '@/components/ds/Input';
import AddressForm, {
  EMPTY_ADDRESS, EMAIL_RE, toShippingAddress, isAddressComplete, oneLineAddress,
} from '@/components/AddressForm';
import StripePaymentSection, { ENV_PUBLISHABLE_KEY } from '@/components/StripePaymentSection';

const money = (n) => '$' + Number(n || 0).toFixed(2);

// Mirrors the backend's RESEND_API_KEY. Drives the confirmation copy so we never
// promise a receipt the backend isn't configured to send. Keep the two in sync
// (both are set together when provisioning an instance).
const ORDER_EMAILS_ENABLED = process.env.NEXT_PUBLIC_ORDER_EMAILS === 'true';

const lbl = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' };
const fieldErr = { margin: 0, fontSize: 12.5, lineHeight: 1.4, color: 'var(--danger)' };
const dashedBox = { padding: '14px 16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 };

const CART_CHANGED = 'Your cart changed in another tab. Review the new total.';
const DEFAULT_ORDER_ERROR = 'Something went wrong at checkout.';

// Where we remember a checkout across a page load. Both hold only a cart id
// (an opaque UUID), never card data or a gift code.
//   REDIRECT: set just before we hand the browser to a redirect-based payment
//             method (Klarna, Affirm); read when Stripe sends the shopper back.
//   PAID:     set once Stripe has confirmed the payment, until the order
//             confirmation is on screen. If the page reloads or the order takes
//             a while to confirm, this is how we still find the order — the cart
//             itself stops being a cart the moment it is paid.
const REDIRECT_KEY = 'site-shop-redirect-cart';
const PAID_KEY = 'site-shop-paid-cart';
const mark = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
const marked = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

/** The shopper-facing words for a failed checkout call. */
function checkoutError(e) {
  if (e?.status === 429) return 'Slow down a moment and try again.';
  switch (e?.code) {
    case 'PAYMENTS_NOT_READY': return 'This store isn’t set up to take payments yet.';
    case 'ORDER_REVIEW_CHANGED': return 'Your order changed. Review the total and try again.';
    case 'CHECKOUT_DETAILS_FROZEN': return 'Payment has already been started for this order. Choose “Edit details” to change it.';
    default: return e?.message || DEFAULT_ORDER_ERROR;
  }
}

export default function CheckoutPage() {
  useStorefrontMotion();
  const router = useRouter();
  const { cartId, cart, items, subtotal, catalogLoading, cartLoading, refreshCart, adoptCart, claimCart, clear } = useCart();
  const { customer, login, register, logout } = useAuth();
  const { config, configLoading } = useShopConfig();

  // account step (guest branch)
  const [guestChoice, setGuestChoice] = useState('guest'); // guest | signin | register
  const [si, setSi] = useState({ email: '', password: '' });
  const [rg, setRg] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [authShown, setAuthShown] = useState(false); // show inline field errors after a submit attempt

  // address
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [addr, setAddr] = useState(EMPTY_ADDRESS);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState('new');
  const [saveNew, setSaveNew] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  // order / payment
  const [phase, setPhase] = useState('details'); // details | payment
  const [paymentCartId, setPaymentCartId] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef(null);
  const onStripeReady = useCallback((fn) => { confirmRef.current = fn; }, []);

  // Discount code (support #143) and gift card (#222) are two different things:
  // a code is a rule the merchant defines, a gift card is stored value we hold
  // against the order. They go to different endpoints.
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState(null); // { ok: boolean, text: string }
  const [codeBusy, setCodeBusy] = useState(false);
  const [giftInput, setGiftInput] = useState('');
  const [giftMsg, setGiftMsg] = useState(null);
  const [giftBusy, setGiftBusy] = useState(false);
  // The gift card code is a bearer secret: it lives in memory only — never in
  // state that renders, storage, a URL or a log — and is used to re-apply the
  // hold after every cart edit, because the engine releases it on any change.
  const giftRef = useRef('');

  // What the shopper was last shown. Anything that changes the cart on the
  // server that they did not just do themselves (another tab, a restart) shows
  // a notice (support #221).
  const lastSig = useRef(null);
  const accept = useCallback((c) => { if (c) lastSig.current = cartSignature(c); return c; }, []);
  const cartNow = useRef(null);
  cartNow.current = cart;
  const savedAddrKey = useRef('');

  const locked = phase === 'payment';

  // --- store capabilities, from the shop's own config ---
  const publishableKey = config?.publishableKey || ENV_PUBLISHABLE_KEY;
  // 'loading' → 'ready' | 'off' (the store is not taking card orders) | 'unavailable' (couldn't load settings)
  const payState = !config
    ? (configLoading ? 'loading' : 'unavailable')
    : ((config.acceptingPayments ?? Boolean(publishableKey)) && publishableKey ? 'ready' : 'off');
  const supportLine = config?.supportEmail ? ` Questions? Email ${config.supportEmail}.` : '';

  // --- money: the SERVER's numbers ---
  // The engine recomputes tax and shipping on every cart change, so the summary
  // shows its numbers rather than a client-side guess that could disagree with
  // the actual charge.
  const shipping = (cart?.shippingCents ?? 0) / 100;
  const tax = (cart?.taxCents ?? 0) / 100;
  const discount = (cart?.discountCents ?? 0) / 100;
  const total = cart?.totalCents != null ? cart.totalCents / 100 : subtotal + shipping + tax;
  const storedValue = (cart?.storedValueCents ?? 0) / 100;
  const amountDue = cart?.amountDueCents != null ? cart.amountDueCents / 100 : total;
  const giftHold = cart?.storedValue?.find((s) => s.kind === 'gift_card');
  const noPaymentNeeded = amountDue === 0 && items.length > 0;
  const zeroTotal = cart?.totalCents === 0;

  // when signed in: prefill email + load saved addresses
  useEffect(() => {
    if (!customer) { setAddresses([]); setSelectedAddrId('new'); return; }
    setEmail(customer.email || '');
    retrieveCustomer()
      .then((c) => {
        const list = c?.addresses || [];
        setAddresses(list);
        const def = list.find((x) => x.is_default) || list[0];
        setSelectedAddrId(def ? def.id : 'new');
      })
      .catch(() => { setAddresses([]); setSelectedAddrId('new'); });
  }, [customer]);

  const usingSaved = !!customer && selectedAddrId !== 'new';
  const chosenAddress = usingSaved ? (addresses.find((a) => a.id === selectedAddrId) || EMPTY_ADDRESS) : addr;
  const effectiveEmail = (customer ? customer.email : email).trim();
  const emailOk = EMAIL_RE.test(effectiveEmail);
  const addressOk = isAddressComplete(chosenAddress);
  const valid = emailOk && addressOk && items.length > 0;

  // --- tell the shopper when the cart moved under them ---
  useEffect(() => {
    if (!cart) return;
    const sig = cartSignature(cart);
    if (lastSig.current !== null && lastSig.current !== sig && !processing) setNotice(CART_CHANGED);
    lastSig.current = sig;
  }, [cart, processing]);

  // The cart was swapped out from under an open payment (restarted in another tab):
  // that payment no longer belongs to this cart.
  const leavePayment = useCallback(() => {
    setPhase('details'); setClientSecret(''); setPaymentCartId(null); confirmRef.current = null;
  }, []);
  useEffect(() => {
    if (phase === 'payment' && paymentCartId && cartId && cartId !== paymentCartId) {
      leavePayment();
      setNotice(CART_CHANGED);
    }
  }, [phase, paymentCartId, cartId, leavePayment]);

  // ---------------------------------------------------------------- gift card
  const giftError = (e) => (e?.code === 'STORED_VALUE_UNAVAILABLE'
    ? 'That gift card can’t be used for this order. Check the code and its balance.'
    : e?.code === 'STORED_VALUE_ALREADY_SELECTED' ? 'A gift card is already applied to this order.'
    : e?.code === 'INVALID_TOTAL' ? 'There’s nothing left to pay on this order, so a gift card isn’t needed.'
    : e?.message || 'We couldn’t apply that gift card.');

  /** Put the remembered gift card back on the cart; returns the resulting cart. Never throws. */
  const reapplyGift = useCallback(async (c) => {
    if (!giftRef.current || !c || c.status !== 'draft' || c.totalCents <= 0) return c;
    if ((c.storedValueCents || 0) > 0) return c;
    try {
      const next = await applyGiftCard(c.id, giftRef.current);
      adoptCart(next); accept(next);
      return next;
    } catch (e) {
      giftRef.current = '';
      setGiftMsg({ ok: false, text: `Your gift card was removed because your order changed: ${giftError(e)}` });
      return c;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adoptCart, accept]);

  const submitGift = async (event) => {
    event.preventDefault();
    const value = giftInput.trim();
    if (!cartId || !value || giftBusy || locked) return;
    if (!GIFT_CODE_RE.test(value)) {
      setGiftMsg({ ok: false, text: 'That doesn’t look like a gift card code. Gift card codes start with NVG_.' });
      return;
    }
    setGiftBusy(true); setGiftMsg(null);
    try {
      const next = await applyGiftCard(cartId, value);
      giftRef.current = value;
      adoptCart(next); accept(next);
      setGiftInput('');
      const suffix = next.storedValue?.find((s) => s.kind === 'gift_card')?.codeSuffix;
      setGiftMsg({ ok: true, text: `Gift card${suffix ? ` ending ${suffix}` : ''} applied.` });
    } catch (e) {
      setGiftMsg({ ok: false, text: giftError(e) });
    } finally { setGiftBusy(false); }
  };

  const dropGift = async () => {
    if (!cartId || giftBusy || locked) return;
    setGiftBusy(true);
    try {
      const next = await removeStoredValue(cartId);
      giftRef.current = '';
      adoptCart(next); accept(next);
      setGiftMsg(null);
    } catch (e) { setGiftMsg({ ok: false, text: e?.message || 'We couldn’t remove the gift card.' }); } finally { setGiftBusy(false); }
  };

  // ------------------------------------------------------------ discount code
  const applyCode = async (event) => {
    event.preventDefault();
    const value = code.trim();
    if (!cartId || !value || codeBusy || locked) return;
    // A gift card pasted in here is a bearer secret; never send it as a "discount code".
    if (/^NVG_/i.test(value)) {
      setCodeMsg({ ok: false, text: 'That’s a gift card. Enter it in the Gift card box below.' });
      return;
    }
    setCodeBusy(true); setCodeMsg(null);
    try {
      const { discount: outcome, cart: next } = await applyDiscountCode(cartId, value);
      adoptCart(next); accept(next);
      // Any cart edit released the gift card hold; put it back.
      await reapplyGift(next);
      setCodeMsg(outcome?.applied === false
        ? { ok: false, text: outcome.message || "That code can't be used on this order." }
        : { ok: true, text: `Code ${value.toUpperCase()} applied.` });
    } catch (e) {
      setCodeMsg({ ok: false, text: e?.message || "That code couldn't be applied. Please try again." });
    } finally { setCodeBusy(false); }
  };

  // --------------------------------------------------------------------- auth
  const authFieldErrors = (vals, mode) => (authShown ? validateAuth(vals, mode) : {});
  const doSignin = async (e) => {
    e?.preventDefault();
    setAuthShown(true); setAuthErr('');
    if (Object.keys(validateAuth(si, 'login')).length) return;
    setAuthBusy(true);
    try { await login(si.email.trim(), si.password); } catch (err) { setAuthErr(authErrorMessage(err, 'login')); } finally { setAuthBusy(false); }
  };
  const doRegister = async (e) => {
    e?.preventDefault();
    setAuthShown(true); setAuthErr('');
    if (Object.keys(validateAuth(rg, 'register')).length) return;
    setAuthBusy(true);
    try { await register({ ...rg, email: rg.email.trim() }); } catch (err) { setAuthErr(authErrorMessage(err, 'register')); } finally { setAuthBusy(false); }
  };

  // ------------------------------------------------------------ finish orders
  const showOrder = useCallback((o, id) => {
    mark(PAID_KEY, null); mark(REDIRECT_KEY, null);
    setConfirming(false); setError('');
    setOrder(o);
    // Empty the cart this order came from — but not a NEW cart the shopper may
    // have started since (when finding an old order after a reload).
    if (!cartNow.current || cartNow.current.id === id || cartNow.current.status !== 'draft') clear();
  }, [clear]);

  /**
   * Payment is confirmed at Stripe; turn it into an order.
   *
   * The order only becomes "paid" when Stripe's webhook reaches the engine, so
   * `/complete` may say "not yet" for a few seconds — completeOrderWithRetry
   * waits it out. If it still isn't confirmed, we say exactly that (the money
   * HAS been taken) instead of a failure the shopper would answer by paying again.
   */
  const finishOrder = useCallback(async (id, tries) => {
    setProcessing(true); setError('');
    try {
      showOrder(await completeOrderWithRetry(id, tries ? { tries } : undefined), id);
    } catch (e) {
      if (e.code === 'ORDER_PENDING') setConfirming(true);
      else {
        mark(PAID_KEY, null);
        setError(`${e?.message || DEFAULT_ORDER_ERROR} If your card was charged, please contact the store before trying again.${supportLine}`);
      }
    } finally { setProcessing(false); }
  }, [showOrder, supportLine]);

  // A confirmed payment from before this page load (a reload mid-confirmation,
  // or the tab was closed): find the order again.
  const resumedPaid = useRef(false);
  useEffect(() => {
    if (resumedPaid.current || order) return;
    const id = marked(PAID_KEY);
    if (!id) return;
    resumedPaid.current = true;
    finishOrder(id);
  }, [order, finishOrder]);

  // Return leg for redirect-based methods (Klarna, Affirm): Stripe sends the
  // customer back here with the outcome in the query string.
  const redirectHandled = useRef(false);
  useEffect(() => {
    if (redirectHandled.current || order) return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('redirect_status');
    if (!status) return;
    redirectHandled.current = true;
    // Strip the params so a refresh can't replay this.
    window.history.replaceState({}, '', window.location.pathname);
    const id = marked(REDIRECT_KEY);
    mark(REDIRECT_KEY, null);
    if (status !== 'succeeded' || !id) {
      setError('Your payment was not completed. Please try again.');
      return;
    }
    mark(PAID_KEY, id);
    resumedPaid.current = true;
    finishOrder(id);
  }, [order, finishOrder]);

  // ------------------------------------------------------------------ payment
  const beginPayment = useCallback(async (c) => {
    const digest = (c.storedValueCents || 0) > 0 ? c.storedValueReviewDigest : undefined;
    const res = await createPaymentIntent(c.id, digest);
    if (!res?.clientSecret) {
      // The engine linked a payment account but gave no secret: say so rather
      // than show card fields that cannot charge.
      throw new Error('Card payment is temporarily unavailable. Please try again later.');
    }
    setClientSecret(res.clientSecret);
    setPaymentCartId(c.id);
    setPhase('payment');
    // The cart is now frozen in `pending_payment`; take that as the new baseline.
    accept(await refreshCart(c.id));
  }, [refreshCart, accept]);

  // A cart that is already mid-payment when the page opens (reload, or payment
  // started in another tab): pick the payment back up rather than strand it.
  const resumedFor = useRef(null);
  useEffect(() => {
    if (!cart || cart.status !== 'pending_payment' || phase !== 'details' || order || confirming) return;
    if (resumedFor.current === cart.id) return;
    if (marked(PAID_KEY) || marked(REDIRECT_KEY) || new URLSearchParams(window.location.search).get('redirect_status')) return;
    resumedFor.current = cart.id;
    (async () => {
      setProcessing(true); setError('');
      try { await beginPayment(cart); }
      catch (e) {
        // "Already being processed": the payment went through; confirm the order.
        if (e.code === 'CHECKOUT_IN_PROGRESS') { mark(PAID_KEY, cart.id); resumedPaid.current = true; finishOrder(cart.id); }
        else setError(checkoutError(e));
      } finally { setProcessing(false); }
    })();
  }, [cart, phase, order, confirming, beginPayment, finishOrder]);

  /** Back to editable: cancels the open payment attempt, which hands back a replacement cart. */
  const editDetails = async () => {
    if (processing || !cartId) return;
    setProcessing(true); setError('');
    try {
      const next = await restartCheckout(cartId);
      adoptCart(next); accept(next);
      leavePayment();
      await reapplyGift(next);
    } catch (e) {
      setError(e?.code === 'CHECKOUT_REVIEW_REQUIRED' || e?.code === 'CHECKOUT_NOT_RESTARTABLE'
        ? 'Your payment is already being processed, so this order can’t be edited.'
        : checkoutError(e));
    } finally { setProcessing(false); }
  };

  /**
   * Step 1 of 2 (and the only step for a $0 order): lock in email + address,
   * then either place the order outright (nothing to pay) or open the payment form.
   */
  const proceed = async () => {
    if (processing) return;
    setShowErrors(true); setEmailTouched(true);
    if (!valid) return;
    setProcessing(true); setError(''); setNotice('');
    try {
      // Is this still the cart the shopper is looking at? It may have changed in
      // another tab since they last focused this one.
      const shownSig = cartSignature(cartNow.current);
      const fresh = await refreshCart(cartId);
      if (!fresh) { setError('Your cart is no longer available.'); return; }
      if (fresh.status === 'pending_payment') { await beginPayment(fresh); return; }
      if (cartSignature(fresh) !== shownSig) { accept(fresh); setNotice(CART_CHANGED); return; }

      if (customer) { await claimCart(); }
      // Keep the address for next time (non-fatal — the order doesn't depend on it).
      if (customer && !usingSaved && saveNew) {
        const key = JSON.stringify(toShippingAddress(addr));
        if (savedAddrKey.current !== key) {
          savedAddrKey.current = key; // one entry per address, however many times Continue is pressed
          try { await createCustomerAddress(toShippingAddress(addr)); } catch { /* an address-book hiccup must not block an order */ }
        }
      }

      // Email + address first; a gift card LAST, because any cart edit releases its hold.
      const shippingAddr = toShippingAddress(chosenAddress);
      let c = await updateCartDetails(cartId, { email: effectiveEmail, shippingAddress: cartAddressToApi(shippingAddr) });
      adoptCart(c); accept(c);
      c = await reapplyGift(c);

      const due = c.amountDueCents ?? c.totalCents;
      if (c.totalCents === 0) {
        if (!config?.acceptingZeroTotalOrders) { setError('This store can’t place orders without a payment yet.'); return; }
        showOrder(await placeZeroTotalOrder(c.id, c.zeroTotalReviewDigest), c.id);
      } else if (due === 0) {
        if (!config?.acceptingStoredValueOrders) { setError('This store can’t take gift card orders yet.'); return; }
        showOrder(await placeStoredValueOrder(c.id, c.storedValueReviewDigest), c.id);
      } else {
        await beginPayment(c);
      }
    } catch (e) {
      // 409 ORDER_REVIEW_CHANGED etc.: re-read so the summary matches the server.
      setError(checkoutError(e));
      if (cartId) accept(await refreshCart(cartId));
    } finally { setProcessing(false); }
  };

  /** Step 2 of 2: confirm the card. Never calls /complete without a confirmed payment. */
  const placeOrder = async () => {
    if (processing) return;
    if (!confirmRef.current) { setError('The payment form is still loading — give it a moment and try again.'); return; }
    setProcessing(true); setError(''); setNotice('');
    try {
      // Re-read the cart right before money moves. The total on the button is a
      // promise; if the cart changed, show the new one and make the shopper agree to it.
      const fresh = await refreshCart(paymentCartId || cartId);
      if (!fresh) {
        // Gone: already paid and confirmed elsewhere, expired, or cancelled.
        leavePayment();
        setError(`This checkout is no longer open. If you already paid, look for your confirmation email or look the order up.${supportLine}`);
        return;
      }
      if (fresh.id !== paymentCartId || fresh.status !== 'pending_payment') {
        leavePayment();
        setNotice(CART_CHANGED);
        return;
      }

      mark(REDIRECT_KEY, fresh.id);
      const { error: stripeError, paymentIntent } = await confirmRef.current(`${window.location.origin}/checkout`);
      if (stripeError) {
        // Card declined / validation failure. Never fall through to complete().
        mark(REDIRECT_KEY, null);
        setError(stripeError.message || 'Your payment could not be processed.');
        return;
      }
      // Redirect-based method: the browser is navigating to the provider, and
      // the return-leg effect above finishes the order when it comes back.
      if (!paymentIntent) return;
      mark(REDIRECT_KEY, null);
      // `processing` is legitimate for async methods — Stripe's webhook settles it.
      if (!['succeeded', 'requires_capture', 'processing'].includes(paymentIntent.status)) {
        setError('Your payment was not completed. Please try again.');
        return;
      }
      mark(PAID_KEY, fresh.id);
      resumedPaid.current = true;
      await finishOrder(fresh.id);
    } catch (e) {
      mark(REDIRECT_KEY, null); // we did not leave the page, so there is no return leg to wait for
      setError(checkoutError(e));
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
        <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>
          {/* Only promise a receipt when order emails are actually configured
              (backend RESEND_API_KEY + this flag). Claiming an email that no
              system sends is the one thing this screen must never do. */}
          Thank you! Your order <strong style={{ color: 'var(--brand-royal)' }}>#{order.display_id}</strong> is confirmed
          {ORDER_EMAILS_ENABLED && order.email
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

  /* ---- Paid, order still confirming ---- */
  if (confirming) {
    const id = marked(PAID_KEY);
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,48px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Payment received</h1>
        <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.7, color: 'var(--text-body)' }}>
          Your payment went through; we&rsquo;re confirming your order. This usually takes a few seconds. <strong>Please don&rsquo;t pay again.</strong>
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-muted)' }}>
          {ORDER_EMAILS_ENABLED ? 'We’ll email your confirmation as soon as it’s ready. ' : ''}
          If it doesn&rsquo;t appear here, you can look your order up with the order number and your email.{supportLine}
        </p>
        {error && <p role="alert" style={{ margin: '14px 0 0', color: 'var(--danger)', fontSize: 13.5 }}>{error}</p>}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="primary" size="lg" disabled={processing || !id} onClick={() => finishOrder(id, 5)}>{processing ? 'Checking…' : 'Check again'}</Button>
          <Button variant="outline" size="lg" onClick={() => router.push('/orders/lookup')}>Look up an order</Button>
        </div>
      </div>
    );
  }

  /* ---- Empty cart ---- */
  if (!catalogLoading && !cartLoading && (!cartId || items.length === 0)) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '90px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 40, textTransform: 'uppercase', color: 'var(--ink)' }}>Your cart is empty</h1>
        <p style={{ margin: '12px 0 22px', color: 'var(--text-muted)' }}>Add something before checking out.</p>
        <Button variant="primary" size="lg" arrow onClick={() => router.push('/shop')}>Start Shopping</Button>
        {error && <p role="alert" style={{ margin: '18px 0 0', color: 'var(--danger)', fontSize: 13.5 }}>{error}</p>}
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
    <button type="button" onClick={() => { setGuestChoice(k); setAuthErr(''); setAuthShown(false); }} style={{ flex: 1, padding: '10px 8px', cursor: 'pointer', border: '1px solid var(--border-strong)', background: guestChoice === k ? 'var(--brand-navy)' : 'var(--white)', color: guestChoice === k ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{text}</button>
  );
  const col = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };

  // --- the primary button, by what is left to do ---
  const siErr = authFieldErrors(si, 'login');
  const rgErr = authFieldErrors(rg, 'register');
  let primary;
  let reason = '';
  if (locked) {
    primary = { label: `Place order · ${money(amountDue)}`, disabled: processing || !clientSecret, onClick: placeOrder };
  } else if (noPaymentNeeded) {
    const ok = zeroTotal ? config?.acceptingZeroTotalOrders : config?.acceptingStoredValueOrders;
    primary = { label: 'Place order', disabled: processing || !valid || !ok, onClick: proceed };
    if (!ok && valid) reason = 'This store isn’t taking online orders yet.';
  } else {
    primary = { label: `Continue to payment · ${money(amountDue)}`, disabled: processing || !valid || payState !== 'ready', onClick: proceed };
    if (payState === 'off' && valid) reason = 'This store isn’t taking online orders yet. Place Order is unavailable until it is set up.';
    else if (payState === 'unavailable' && valid) reason = 'We couldn’t load this store’s payment settings. Refresh the page to try again.';
  }
  if (!locked && !reason && !valid && !processing) {
    reason = items.length === 0
      ? 'Your cart is empty.'
      : !emailOk ? 'Enter a valid email to continue.'
        : 'Complete your shipping address to continue.';
  }

  const lockedAddr = locked ? addressFromApi(cart?.shippingAddress) : null;
  const freeShipLine = [
    config?.freeShippingThreshold ? `Free U.S. shipping over ${money(config.freeShippingThreshold).replace(/\.00$/, '')}` : '',
    config?.shipsFrom?.city && config?.shipsFrom?.state ? `Ships from ${config.shipsFrom.city}, ${config.shipsFrom.state}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div data-screen-label="Checkout" style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div data-rise>
        <Eyebrow color="royal" rule>Secure Checkout</Eyebrow>
        <h1 style={{ margin: '10px 0 28px', fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,4.6vw,54px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Checkout</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px,100%),1fr))', gap: 40, alignItems: 'start' }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, minWidth: 0 }}>
          {locked ? (
            /* Payment is prepared: the details are frozen into the order. */
            <section>
              {stepHead(1, 'Your details')}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', background: 'var(--gray-100)', fontSize: 14, lineHeight: 1.7, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>
                <div><strong style={{ color: 'var(--ink)' }}>Email:</strong> {cart?.contactEmail || effectiveEmail}</div>
                {lockedAddr && (
                  <div><strong style={{ color: 'var(--ink)' }}>Ship to:</strong> {[lockedAddr.first_name, lockedAddr.last_name].filter(Boolean).join(' ')}, {oneLineAddress(lockedAddr)}</div>
                )}
                <div><strong style={{ color: 'var(--ink)' }}>Delivery:</strong> Standard shipping — {shipping ? money(shipping) : 'Free'}</div>
                <button type="button" onClick={editDetails} disabled={processing} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', textDecoration: 'underline', padding: 0, fontSize: 13.5 }}>Edit details (cancels this payment)</button>
              </div>
            </section>
          ) : (
            <>
              {/* 1. Account */}
              <section>
                {stepHead(1, 'Account')}
                {customer ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--gray-100)' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>Signed in as <strong style={{ color: 'var(--ink)' }}>{customer.email}</strong></span>
                    <button type="button" onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', fontSize: 13, textDecoration: 'underline' }}>Not you? Sign out</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      {segBtn('guest', 'Guest')}{segBtn('signin', 'Sign in')}{segBtn('register', 'Create account')}
                    </div>
                    {guestChoice === 'guest' && (
                      <div style={col}>
                        <span style={lbl}>Email</span>
                        <Input type="email" autoComplete="email" placeholder="you@email.com" value={email} invalid={emailTouched && !emailOk} aria-invalid={emailTouched && !emailOk} onBlur={() => setEmailTouched(true)} onChange={(e) => setEmail(e.target.value)} />
                        {emailTouched && !emailOk
                          ? <p role="alert" style={fieldErr}>Enter a valid email address.</p>
                          : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>We&rsquo;ll send your receipt here. Create an account below to track orders.</span>}
                      </div>
                    )}
                    {guestChoice === 'signin' && (
                      <form onSubmit={doSignin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={col}><span style={lbl}>Email</span><Input type="email" autoComplete="email" value={si.email} invalid={!!siErr.email} onChange={(e) => setSi({ ...si, email: e.target.value })} />{siErr.email && <p role="alert" style={fieldErr}>{siErr.email}</p>}</div>
                        <div style={col}><span style={lbl}>Password</span><Input type="password" autoComplete="current-password" value={si.password} invalid={!!siErr.password} onChange={(e) => setSi({ ...si, password: e.target.value })} />{siErr.password && <p role="alert" style={fieldErr}>{siErr.password}</p>}</div>
                        {authErr && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5, lineHeight: 1.5 }}>{authErr}</p>}
                        <Button type="submit" variant="navy" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign In'}</Button>
                      </form>
                    )}
                    {guestChoice === 'register' && (
                      <form onSubmit={doRegister} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                          <div style={col}><span style={lbl}>First name</span><Input autoComplete="given-name" value={rg.first_name} onChange={(e) => setRg({ ...rg, first_name: e.target.value })} /></div>
                          <div style={col}><span style={lbl}>Last name</span><Input autoComplete="family-name" value={rg.last_name} onChange={(e) => setRg({ ...rg, last_name: e.target.value })} /></div>
                        </div>
                        <div style={col}><span style={lbl}>Email</span><Input type="email" autoComplete="email" value={rg.email} invalid={!!rgErr.email} onChange={(e) => setRg({ ...rg, email: e.target.value })} />{rgErr.email && <p role="alert" style={fieldErr}>{rgErr.email}</p>}</div>
                        <div style={col}><span style={lbl}>Password</span><Input type="password" autoComplete="new-password" value={rg.password} invalid={!!rgErr.password} onChange={(e) => setRg({ ...rg, password: e.target.value })} />{rgErr.password ? <p role="alert" style={fieldErr}>{rgErr.password}</p> : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>At least 8 characters.</span>}</div>
                        {authErr && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13.5, lineHeight: 1.5 }}>{authErr}</p>}
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
                    {addresses.map((a) => {
                      const ok = isAddressComplete(a);
                      return (
                        <label key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', cursor: 'pointer', border: `1px solid ${selectedAddrId === a.id ? 'var(--brand-royal)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', background: selectedAddrId === a.id ? 'var(--royal-100)' : 'var(--white)' }}>
                          <input type="radio" name="addr" checked={selectedAddrId === a.id} onChange={() => setSelectedAddrId(a.id)} />
                          <span style={{ fontSize: 13.5, color: 'var(--text-body)', minWidth: 0, overflowWrap: 'anywhere' }}>
                            <strong style={{ color: 'var(--text-strong)' }}>{[a.first_name, a.last_name].filter(Boolean).join(' ') || 'Saved address'}</strong>
                            <br />{oneLineAddress(a)}
                            {!ok && <><br /><span style={{ color: 'var(--danger)' }}>This address is missing details. Choose “Use a new address”, or fix it in your account.</span></>}
                          </span>
                        </label>
                      );
                    })}
                    <label style={{ display: 'flex', gap: 12, padding: '12px 14px', cursor: 'pointer', border: `1px solid ${selectedAddrId === 'new' ? 'var(--brand-royal)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', background: selectedAddrId === 'new' ? 'var(--royal-100)' : 'var(--white)' }}>
                      <input type="radio" name="addr" checked={selectedAddrId === 'new'} onChange={() => setSelectedAddrId('new')} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>Use a new address</span>
                    </label>
                  </div>
                )}
                {!usingSaved && (
                  <>
                    <AddressForm value={addr} onChange={setAddr} showErrors={showErrors} />
                    {customer && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13.5, color: 'var(--text-body)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} /> Save this address to my account
                      </label>
                    )}
                  </>
                )}
              </section>

              {/* 3. Delivery — the merchant's own shipping rules are applied by the server */}
              <section>
                {stepHead(3, 'Delivery')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid var(--brand-royal)', borderRadius: 'var(--radius-md)', background: 'var(--royal-100)' }}>
                  <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-strong)' }}>Standard shipping</span>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                    {cart?.shippingAddress ? (shipping ? money(shipping) : 'Free') : 'Calculated after address'}
                  </span>
                </div>
              </section>
            </>
          )}

          {/* 4. Payment */}
          <section>
            {stepHead(locked ? 2 : 4, 'Payment')}
            {locked ? (
              !clientSecret ? (
                <div style={dashedBox}>Loading secure payment…</div>
              ) : (
                <StripePaymentSection publishableKey={publishableKey} clientSecret={clientSecret} onReady={onStripeReady} />
              )
            ) : payState === 'loading' ? (
              <div style={dashedBox}>Checking payment options…</div>
            ) : payState === 'unavailable' ? (
              <div role="alert" style={{ ...dashedBox, borderStyle: 'solid', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                We couldn&rsquo;t load this store&rsquo;s payment settings. Refresh the page to try again.
              </div>
            ) : noPaymentNeeded ? (
              <div style={dashedBox}>
                {zeroTotal ? 'There’s nothing to pay on this order.' : 'Your gift card covers this order — nothing else to pay.'}
                {(zeroTotal ? !config?.acceptingZeroTotalOrders : !config?.acceptingStoredValueOrders) && ' This store isn’t taking online orders yet, so it can’t be placed.'}
              </div>
            ) : payState === 'off' ? (
              <div role="status" style={{ ...dashedBox, borderStyle: 'solid', color: 'var(--text-body)' }}>
                <strong style={{ color: 'var(--ink)' }}>This store isn&rsquo;t taking online orders yet.</strong> Payments haven&rsquo;t been set up, so there&rsquo;s no way to pay and Place Order stays off. Please check back soon.{supportLine}
              </div>
            ) : (
              <div style={dashedBox}>
                {valid
                  ? 'Choose “Continue to payment” and your payment options will appear here.'
                  : 'Complete the steps above, then continue to payment.'}
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <div style={{ position: 'sticky', top: 100, minWidth: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '22px 22px 24px', background: 'var(--white)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)' }}>Order summary</h2>
          {notice && (
            <div role="status" style={{ margin: '0 0 14px', padding: '10px 12px', borderRadius: 4, background: 'var(--gray-100)', borderLeft: '3px solid var(--brand-red)', color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.45, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
            {items.map((it) => (
              <div key={it.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div role="img" aria-label={it.title} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 4, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${it.image || ''}")` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}{it.variantName ? ` — ${it.variantName}` : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty {it.qty}</div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{money(it.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--text-body)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount{cart?.discountCode ? ` (${cart.discountCode})` : ''}</span><span>−{money(discount)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Shipping</span><span>{cart?.shippingAddress ? (shipping ? money(shipping) : 'Free') : '—'}</span></div>
            {/* The total already includes tax; show it so the sum adds up (same fix as the dashboard store, #134). */}
            {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>{money(tax)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, color: 'var(--ink)', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}><span>Total</span><span>{money(total)}</span></div>
            {storedValue > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gift card{giftHold?.codeSuffix ? ` (••••${giftHold.codeSuffix})` : ''}</span><span>−{money(storedValue)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)' }}><span>Amount due</span><span>{money(amountDue)}</span></div>
              </>
            )}
          </div>

          {/* Discount code */}
          <form onSubmit={applyCode} style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}><Input aria-label="Discount code" placeholder="Discount code" value={code} disabled={codeBusy || locked} onChange={(e) => { setCode(e.target.value); setCodeMsg(null); }} /></div>
            <span style={{ flexShrink: 0 }}><Button variant="secondary" size="md" type="submit" disabled={codeBusy || !code.trim() || locked}>{codeBusy ? 'Applying…' : 'Apply'}</Button></span>
          </form>
          {codeMsg && <p role="status" style={{ margin: '6px 0 0', fontSize: 13, color: codeMsg.ok ? 'var(--text-body)' : 'var(--danger)' }}>{codeMsg.text}</p>}

          {/* Gift card — works for guests; held against the order, not a discount */}
          {giftHold ? (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-body)' }}>
              <span>Gift card applied.</span>
              {!locked && <button type="button" onClick={dropGift} disabled={giftBusy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--link)', textDecoration: 'underline', padding: 0, fontSize: 13 }}>Remove</button>}
            </div>
          ) : (
            <form onSubmit={submitGift} style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 0', minWidth: 0 }}><Input aria-label="Gift card code" placeholder="Gift card code" autoComplete="off" spellCheck={false} value={giftInput} disabled={giftBusy || locked} onChange={(e) => { setGiftInput(e.target.value); setGiftMsg(null); }} /></div>
              <span style={{ flexShrink: 0 }}><Button variant="secondary" size="md" type="submit" disabled={giftBusy || !giftInput.trim() || locked}>{giftBusy ? 'Applying…' : 'Apply'}</Button></span>
            </form>
          )}
          {giftMsg && <p role="status" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.45, color: giftMsg.ok ? 'var(--text-body)' : 'var(--danger)' }}>{giftMsg.text}</p>}

          {error && <p role="alert" style={{ margin: '14px 0 0', color: 'var(--danger)', fontSize: 13.5, lineHeight: 1.5 }}>{error}</p>}
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" size="lg" fullWidth arrow={!processing} disabled={primary.disabled} onClick={primary.onClick}>
              {processing ? (locked ? 'Placing order…' : 'Working…') : primary.label}
            </Button>
          </div>
          {reason && !processing && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted)', textAlign: 'center' }}>{reason}</p>
          )}
          {freeShipLine && <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{freeShipLine}</p>}
        </div>
      </div>
    </div>
  );
}
