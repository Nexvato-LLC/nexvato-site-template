'use client';

/**
 * Stripe payment section (C0).
 *
 * Renders the Stripe Payment Element, which shows EVERY payment method enabled
 * on the Stripe account for this amount/currency — card, and Klarna / Affirm /
 * Afterpay when they're switched on in the Stripe Dashboard. That is why there
 * is no per-method code here: enabling buy-now-pay-later is configuration, not
 * a code change (see medusa-config.ts for the backend half).
 *
 * Renders NOTHING when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is unset, so the
 * storefront falls back to the honest manual-payment notice instead of showing
 * card fields that cannot charge.
 */

import { useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** True when the storefront is configured to take real card payments. */
export const stripeEnabled = Boolean(PUBLISHABLE_KEY);

// loadStripe must be called once, outside render, or the SDK re-initializes.
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

/** Match the storefront's look so the embedded fields don't feel bolted on. */
const appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#2e3192',
    colorText: '#16181d',
    colorDanger: '#b42318',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
};

function PaymentFields({ onReady }) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) return;
    // Hand the parent a confirm() it can call from the existing Place Order
    // button, so the checkout keeps ONE primary action.
    onReady(async (returnUrl) => {
      // redirect: 'if_required' keeps cards inline; redirect-based methods
      // (Klarna, Affirm) navigate away and come back to returnUrl, where the
      // page finishes the order from the query params.
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });
      return result;
    });
    return () => onReady(null);
  }, [stripe, elements, onReady]);

  return <PaymentElement options={{ layout: 'tabs' }} />;
}

export default function StripePaymentSection({ clientSecret, onReady }) {
  if (!stripePromise || !clientSecret) return null;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
      <PaymentFields onReady={onReady} />
    </Elements>
  );
}
