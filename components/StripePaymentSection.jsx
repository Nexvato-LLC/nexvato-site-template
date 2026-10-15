'use client';

/**
 * Stripe payment section.
 *
 * Renders the Stripe Payment Element, which shows EVERY payment method enabled
 * on the Stripe account for this amount/currency — card, and Klarna / Affirm /
 * Afterpay when they're switched on in the Stripe Dashboard. That is why there
 * is no per-method code here: enabling buy-now-pay-later is configuration, not
 * a code change.
 *
 * The publishable key is passed in at RUNTIME (from the shop config), not read
 * from a build-time variable: an app whose build never had
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set used to render no payment form at all
 * (support #209). The env var survives only as a fallback — see
 * ENV_PUBLISHABLE_KEY.
 */

import { useEffect, useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

/** Build-time fallback only; the shop config's key wins whenever it has one. */
export const ENV_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// loadStripe must run once per key, outside render, or the SDK re-initializes
// (and Stripe logs a warning on every call). A key can change at runtime — the
// merchant moves from test to live — so this is a cache by key, not a singleton.
const stripeByKey = new Map();
function stripeFor(key) {
  if (!stripeByKey.has(key)) stripeByKey.set(key, loadStripe(key));
  return stripeByKey.get(key);
}

/** Match the storefront's look so the embedded fields don't feel bolted on. */
const appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#4f46e5',
    colorText: '#16181d',
    colorDanger: '#c2410c',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
};

function PaymentFields({ onReady }) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) return undefined;
    // Hand the parent a confirm() it can call from the existing Place Order
    // button, so the checkout keeps ONE primary action.
    onReady(async (returnUrl) => {
      // redirect: 'if_required' keeps cards inline; redirect-based methods
      // (Klarna, Affirm) navigate away and come back to returnUrl, where the
      // page finishes the order from the query params.
      return stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });
    });
    return () => onReady(null);
  }, [stripe, elements, onReady]);

  return <PaymentElement options={{ layout: 'tabs' }} />;
}

export default function StripePaymentSection({ publishableKey, clientSecret, onReady }) {
  const stripePromise = useMemo(() => (publishableKey ? stripeFor(publishableKey) : null), [publishableKey]);
  // Elements reads its options once; a stable object avoids "unsupported prop change" warnings.
  const options = useMemo(() => ({ clientSecret, appearance }), [clientSecret]);
  if (!stripePromise || !clientSecret) return null;
  return (
    // key: a new client secret is a new payment, so mount a fresh Elements.
    <Elements key={clientSecret} stripe={stripePromise} options={options}>
      <PaymentFields onReady={onReady} />
    </Elements>
  );
}
