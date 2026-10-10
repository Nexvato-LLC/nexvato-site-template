'use client';

/**
 * Stripe Payment Element for checkout.
 *
 * The publishable key comes from the store's settings at RUNTIME
 * (`publishableKey` on GET /:shopId), never from the build (support #135).
 * A key baked into the bundle went stale the moment the store's Stripe mode
 * changed, and could switch on a card form for a store that cannot take
 * payment. The Element shows every method enabled on the store's Stripe
 * account for this amount — card, and buy-now-pay-later when switched on.
 *
 * The parent keeps ONE primary action ("Place Order"): this component hands
 * it `confirm(returnUrl)` and `retrieve()` through `onReady`, and never
 * submits anything itself.
 */

import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// One Stripe instance per key: loadStripe must not re-run on every render.
const stripeByKey = new Map();
function stripeFor(key) {
  if (!stripeByKey.has(key)) stripeByKey.set(key, loadStripe(key));
  return stripeByKey.get(key);
}

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

export default function StripePaymentSection({ publishableKey, clientSecret, onReady }) {
  const mountRef = useRef(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!publishableKey || !clientSecret) return undefined;
    let alive = true;
    let element = null;
    setLoadError('');
    stripeFor(publishableKey)
      .then((stripe) => {
        if (!alive || !mountRef.current) return;
        if (!stripe) throw new Error('Payment library unavailable');
        const elements = stripe.elements({ clientSecret, appearance });
        element = elements.create('payment', { layout: 'tabs' });
        element.mount(mountRef.current);
        element.on('ready', () => {
          if (!alive) return;
          onReady({
            // redirect: 'if_required' keeps cards inline; redirect-based
            // methods (Klarna, Affirm) leave and come back to returnUrl.
            confirm: (returnUrl) => stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: 'if_required' }),
            // Reconcile an attempt whose outcome is unknown (network drop)
            // by READING the intent — never by confirming it again.
            retrieve: () => stripe.retrievePaymentIntent(clientSecret),
          });
        });
      })
      .catch(() => { if (alive) setLoadError('The payment form could not be loaded. Refresh this page to try again.'); });
    return () => {
      alive = false;
      onReady(null);
      try { element?.destroy(); } catch {}
    };
  }, [publishableKey, clientSecret, onReady]);

  return (
    <div>
      <div ref={mountRef} />
      {loadError && <p role="alert" style={{ margin: '10px 0 0', color: 'var(--danger)', fontSize: 13.5 }}>{loadError}</p>}
    </div>
  );
}
