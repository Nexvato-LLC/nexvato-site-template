/**
 * The hand-off from /checkout to /order-confirmed.
 *
 * The confirmation has its own URL so ad platforms (Google Ads, Meta) can count
 * a purchase by page address. Checkout writes the confirmed order here and moves
 * the shopper on; the confirmation page reads it back.
 *
 * sessionStorage, not the URL: an order number plus email in a query string
 * would land in analytics, ad platforms and server logs. sessionStorage stays in
 * this tab, survives a reload of the confirmation, and is gone when the tab closes.
 */
const KEY = 'site-shop-confirmed-order';

// Mirrors the backend's RESEND_API_KEY. Drives the confirmation copy so we never
// promise a receipt the backend isn't configured to send. Keep the two in sync
// (both are set together when provisioning an instance).
export const ORDER_EMAILS_ENABLED = process.env.NEXT_PUBLIC_ORDER_EMAILS === 'true';

export const ORDER_CONFIRMED_PATH = '/order-confirmed';

/** Keep only what the confirmation shows. `o` is a mapOrder() result. */
export function rememberConfirmedOrder(o) {
  const summary = {
    display_id: o.display_id,
    email: o.email || '',
    total: o.total,
    currency: o.currency,
    noPaymentRequired: !!o.noPaymentRequired,
    items: (o.items || []).map(({ title, variant, quantity, total }) => ({ title, variant, quantity, total })),
  };
  try { sessionStorage.setItem(KEY, JSON.stringify(summary)); } catch {}
}

export function readConfirmedOrder() {
  try {
    const o = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return o && o.display_id ? o : null;
  } catch { return null; }
}
