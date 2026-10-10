/**
 * Free-shipping copy, from the store's REAL settings (support #138).
 *
 * WAS: "$75" and "U.S." were hardcoded in the cart, the header, the product
 * page and checkout, while the server charged by whatever the merchant had
 * configured — so the progress bar could promise free shipping on a parcel
 * the checkout then charged for, or the reverse.
 *
 * Now it mirrors the server's rule (api/src/lib/shop/money.ts): shipping is
 * free when the subtotal AFTER discounts is at least
 * `freeShippingThresholdCents`. That value is an integer number of cents,
 * or null.
 *   null → the store makes no free-shipping promise: say nothing.
 *   0    → shipping is always free.
 * No destination country or dispatch time is implied — the settings say
 * neither.
 */

/** Integer cents → "$60.00", in the store's currency. */
export function formatCents(cents, currency = 'usd') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'usd').toUpperCase() }).format((cents || 0) / 100);
  } catch {
    return '$' + ((cents || 0) / 100).toFixed(2);
  }
}

/** The configured threshold in cents, or null when the store promises none. */
export function freeShippingThreshold(config) {
  const t = config?.freeShippingThresholdCents;
  return Number.isInteger(t) && t >= 0 ? t : null;
}

/** One line describing the store's free-shipping offer, or '' when it has none. */
export function freeShippingOffer(config) {
  const t = freeShippingThreshold(config);
  if (t === null) return '';
  if (t === 0) return 'Free shipping on every order';
  return `Free shipping on orders of ${formatCents(t, config?.currency)} or more`;
}

/**
 * Progress toward free shipping for a server cart. `goodsCents` is the cart's
 * subtotal after discounts — the number the server compares. Returns null
 * when the store makes no free-shipping promise.
 */
export function freeShippingProgress(config, goodsCents) {
  const t = freeShippingThreshold(config);
  if (t === null) return null;
  const goods = Math.max(0, goodsCents || 0);
  if (t === 0) return { pct: 100, remainingCents: 0, unlocked: true, message: 'Free shipping on every order' };
  const remainingCents = Math.max(0, t - goods);
  return {
    pct: Math.min(100, Math.round((goods / t) * 100)),
    remainingCents,
    unlocked: remainingCents === 0,
    message: goods <= 0
      ? freeShippingOffer(config)
      : remainingCents > 0
        ? `${formatCents(remainingCents, config?.currency)} away from free shipping`
        : 'Free shipping unlocked',
  };
}
