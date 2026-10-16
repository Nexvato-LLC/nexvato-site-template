import { productArt } from '@/lib/data';

/**
 * Nexvato Shop client.
 *
 * The store runs on Nexvato's own multi-tenant commerce engine. The merchant
 * manages this shop inside the Nexvato dashboard, so there is no per-client
 * backend to operate and no second system of record.
 *
 * ⚠️ UNITS: this API speaks CENTS (integers). The storefront components speak
 * DOLLARS. The conversion happens HERE, once, in `centsToDollars` — never
 * scattered through components, where a missed division is a 100× price bug.
 *
 * ⚠️ SHAPES: the API speaks camelCase (`firstName`, `line1`, `orderNumber`).
 * The components were written against snake_case (`first_name`, `address_1`,
 * `display_id`). Every mapping between the two lives in this file
 * (`addressFromApi` / `addressToApi` / `mapOrder` / `mapCustomer`) so a
 * component never reads an API field directly. That mismatch is what made a
 * saved address render as "- Springfield, IL" and left Place Order disabled
 * (support #212).
 */

export const SHOP_API =
  process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://api.nexvato.com/api/v1/public/shop';
export const SHOP_ID = process.env.NEXT_PUBLIC_SHOP_ID || '';

/** True when the platform has wired this site to a store. */
export const IS_CONNECTED = Boolean(SHOP_ID);

/** The ONE place cents become dollars. */
function centsToDollars(cents) {
  return typeof cents === 'number' ? cents / 100 : 0;
}

function fallbackMessage(status) {
  if (status === 429) return 'Too many requests. Slow down a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return `Request failed (${status})`;
}

/**
 * Every failure becomes an Error carrying the API's own `message`, plus:
 *   .code       the API error code (OUT_OF_STOCK, PASSWORD_TOO_SHORT, ...)
 *   .status     HTTP status (0 when the request never reached the server)
 *   .available  units still available, when the API says so (OUT_OF_STOCK)
 *   .retryAfter seconds to wait, when the API sends Retry-After (429)
 */
async function api(path, options = {}) {
  // ⚠️ FAIL LOUDLY, NOT SILENTLY. Without a shop id every catalog call would
  // hit an invalid URL and be caught by the callers' try/catch, producing a
  // site that builds green, deploys green, and sells nothing. That exact
  // failure shipped once. An explicit throw surfaces it in the build log and
  // in the setup notice on the homepage.
  if (!SHOP_ID) {
    throw new Error(
      'NEXT_PUBLIC_SHOP_ID is not set — this site is not connected to a store.',
    );
  }
  let res;
  try {
    res = await fetch(`${SHOP_API}${path}`, {
      // A caller that passes `next` (server-side revalidation) opts out of
      // no-store; everything else is always live.
      ...(options.next ? {} : { cache: 'no-store' }),
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    const err = new Error('We couldn’t reach the store. Check your connection and try again.');
    err.code = 'NETWORK';
    err.status = 0;
    throw err;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = body?.error || {};
    const err = new Error(e.message || fallbackMessage(res.status));
    err.code = e.code;
    err.status = res.status;
    if (typeof e.available === 'number') err.available = e.available;
    const retry = Number(res.headers.get('retry-after'));
    if (retry > 0) err.retryAfter = retry;
    throw err;
  }
  return body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** Only http(s) URLs are ever rendered as images — never javascript:/data: from an API field. */
function safeUrl(v) {
  const u = text(v);
  return /^https?:\/\//i.test(u) ? u : '';
}

// ── Shop config (runtime) ───────────────────────────────────────────────────

/**
 * Normalize `GET /:shopId` into what the storefront needs.
 *
 * WHY RUNTIME: the Stripe publishable key, whether the store is taking
 * payments, the shipping rules and the shop's name all live on the server and
 * change without a deploy. Baking them into the bundle at build time
 * (NEXT_PUBLIC_*) is what left checkout with no payment form on an app where
 * the build variable was never set (support #209).
 */
export function normalizeShopConfig(shop) {
  if (!shop || typeof shop !== 'object') return null;
  const sf = shop.storefront && typeof shop.storefront === 'object' ? shop.storefront : {};
  const sfBrand = sf.brand && typeof sf.brand === 'object' ? sf.brand : {};
  const positive = (c) => (typeof c === 'number' && c > 0 ? c / 100 : null);
  const from = shop.shipsFrom && typeof shop.shipsFrom === 'object' ? shop.shipsFrom : null;
  return {
    id: shop.id,
    // The shop's own name first (it is what the order emails and the payment
    // descriptor say); the org-wide brand name is the fallback. The API's last
    // resort for that is the literal "Store", which we treat as "no name".
    name: text(shop.name) || (text(sfBrand.name) !== 'Store' ? text(sfBrand.name) : ''),
    logoUrl: safeUrl(sfBrand.logoUrl),
    currency: text(shop.currency) || 'usd',
    supportEmail: text(shop.supportEmail),
    flatShipping: positive(shop.flatShippingCents),
    freeShippingThreshold: positive(shop.freeShippingThresholdCents),
    shipsFrom: from && (from.city || from.state) ? { city: text(from.city), state: text(from.state) } : null,
    publishableKey: text(shop.publishableKey),
    // The store's own connected account (direct charges); null until it accepts payments.
    stripeAccountId: text(shop.stripeAccountId),
    // `undefined` when an older API does not send it, so callers can tell
    // "not accepting" from "this API does not say".
    acceptingPayments: typeof shop.acceptingPayments === 'boolean' ? shop.acceptingPayments : undefined,
    acceptingZeroTotalOrders: shop.acceptingZeroTotalOrders === true,
    acceptingStoredValueOrders: shop.acceptingStoredValueOrders === true,
    siteContent: sf.content && typeof sf.content === 'object' && !Array.isArray(sf.content) ? sf.content : {},
    seo: sf.seo && typeof sf.seo === 'object' && !Array.isArray(sf.seo) ? sf.seo : {},
  };
}

/**
 * Fetch the shop config. null when no shop is connected or the API is down —
 * callers fall back to lib/brand.js and the "store not taking orders" state.
 *
 * `fresh: true` (client, checkout) bypasses every cache. The server render
 * (root layout) revalidates every minute so pages can still be cached.
 */
export async function fetchShopConfig({ fresh = false } = {}) {
  if (!IS_CONNECTED) return null;
  try {
    const { shop } = await api(`/${SHOP_ID}`, fresh ? {} : { next: { revalidate: 60 } });
    return normalizeShopConfig(shop);
  } catch {
    return null;
  }
}

// ── Catalog ─────────────────────────────────────────────────────────────────

/**
 * Map an API product into the shape the storefront already expects.
 * Display-only attributes (brand, tone, badges, specs) ride in `metadata`,
 * which the commerce engine stores but never interprets.
 *
 * ⚠️ NO RATING FIELDS. A rating or review count read from `metadata` is
 * whatever someone typed into a free-form field; showing it next to "verified"
 * reviews is how a candle store ended up with a 4.8-star baseball glove
 * (support #213). Ratings come ONLY from the reviews endpoint
 * (`fetchProductReviews`), which holds purchase-verified reviews.
 */
export function mapShopProduct(p) {
  const m = p.metadata || {};
  const variants = (p.variants || []).map((v) => ({
    id: v.id,
    name: v.name || '',
    price: centsToDollars(v.priceCents),
    compareAt: v.compareAtCents ? centsToDollars(v.compareAtCents) : undefined,
    inStock: v.inStock !== false,
  }));
  const first = variants[0] || {};
  const tone = m.tone || '#1f3a5f';
  const cat = m.cat || p.category?.name || '';
  const brand = m.brand || '';
  const images = Array.isArray(p.images) ? p.images.map(safeUrl).filter(Boolean) : [];
  return {
    id: p.slug,            // the storefront routes by slug
    handle: p.slug,
    productId: p.id,
    variantId: first.id,
    variants,
    brand,
    title: p.name,
    price: first.price || 0,
    compareAt: first.compareAt,
    cat,
    tone,
    collectible: !!m.collectible,
    badge: m.badge || undefined,
    badgeVariant: m.badgeVariant || undefined,
    blurb: p.description || m.blurb || undefined,
    specs: Array.isArray(m.specs) ? m.specs : undefined,
    collection: p.category?.slug || null,
    // A product with no purchasable variant cannot be bought.
    inStock: variants.some((v) => v.inStock),
    images,
    // Real photo when the merchant uploaded one; generated placeholder art otherwise.
    image: images[0] || productArt({ tone, cat, brand }),
  };
}

/** Full catalog. Returns [] on any failure so the UI never crashes. */
export async function fetchCatalog() {
  try {
    const { products } = await api(`/${SHOP_ID}/products`);
    return (products || []).map(mapShopProduct);
  } catch {
    return [];
  }
}

/** One product by slug. null when missing — callers render a 404. */
export async function fetchProduct(slug) {
  try {
    const { product } = await api(`/${SHOP_ID}/products/${encodeURIComponent(slug)}`);
    return product ? mapShopProduct(product) : null;
  } catch {
    return null;
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Active collections, for the chips on /shop and the sitemap. [] on failure. */
export async function fetchCollections() {
  try {
    const { collections } = await api(`/${SHOP_ID}/collections`);
    return (collections || []).map((c) => ({
      id: c.id, name: c.name, slug: c.slug, description: c.description || '', imageUrl: safeUrl(c.imageUrl),
    }));
  } catch {
    return [];
  }
}

/**
 * One collection and its products.
 *   { status: 'ok', collection, products }
 *   { status: 'missing' }  unknown / draft / archived slug → the caller 404s
 *   { status: 'error' }    the API is unreachable → a retryable message, NOT a 404
 *
 * The API also resolves a RENAMED collection's old address to the new one, so
 * `collection.slug` may differ from the slug asked for; callers redirect.
 */
export async function fetchCollectionPage(slug) {
  if (!IS_CONNECTED || !SLUG_RE.test(slug) || slug.length > 80) return { status: 'missing' };
  try {
    const { collection } = await api(`/${SHOP_ID}/collections/${encodeURIComponent(slug)}`);
    const products = [];
    let cursor = null;
    // Up to 5 pages of 100 — more than any storefront grid should render at once.
    for (let page = 0; page < 5; page++) {
      const qs = new URLSearchParams({ collection: collection.slug, limit: '100' });
      if (cursor) qs.set('cursor', cursor);
      const res = await api(`/${SHOP_ID}/products?${qs}`);
      products.push(...(res.products || []).map(mapShopProduct));
      cursor = res.nextCursor;
      if (!cursor) break;
    }
    return {
      status: 'ok',
      collection: {
        id: collection.id, name: collection.name, slug: collection.slug,
        description: collection.description || '', imageUrl: safeUrl(collection.imageUrl),
        seoTitle: collection.seoTitle || '', seoDescription: collection.seoDescription || '',
      },
      products,
    };
  } catch (e) {
    if (e.status === 404 || e.code === 'VALIDATION') return { status: 'missing' };
    return { status: 'error' };
  }
}

// ── Reviews ─────────────────────────────────────────────────────────────────

/**
 * Real, purchase-verified reviews for a product (by product ID, not slug).
 * null when the request fails — callers then show nothing rather than a
 * made-up rating.
 */
export async function fetchProductReviews(productId, page = 1) {
  if (!productId) return null;
  try {
    const res = await api(`/${SHOP_ID}/products/${encodeURIComponent(productId)}/reviews?page=${page}`);
    return {
      reviews: (res.reviews || []).map((r) => ({
        id: r.id,
        name: r.reviewerName || 'Customer',
        rating: Number(r.rating) || 0,
        title: r.title || '',
        body: r.body || '',
        createdAt: r.createdAt,
        verified: r.verifiedPurchase !== false,
      })),
      total: Number(res.total) || 0,
      average: typeof res.averageRating === 'number' ? res.averageRating : null,
      hasNext: !!res.hasNext,
      page: Number(res.page) || page,
    };
  } catch {
    return null;
  }
}

// ── Addresses / customers / orders: API ⇄ UI mapping ───────────────────────
// UI shape (snake_case):  { id, first_name, last_name, address_1, address_2,
//                           city, province, postal_code, country_code, phone, is_default }
// API shape (camelCase):  { id, firstName, lastName, line1, line2, city,
//                           province, postalCode, country, phone, isDefault }

/** API → UI. Tolerates either casing, so a half-migrated payload still renders. */
export function addressFromApi(a) {
  if (!a) return null;
  return {
    id: a.id,
    first_name: a.firstName ?? a.first_name ?? '',
    last_name: a.lastName ?? a.last_name ?? '',
    address_1: a.line1 ?? a.address_1 ?? '',
    address_2: a.line2 ?? a.address_2 ?? '',
    city: a.city ?? '',
    province: a.province ?? '',
    postal_code: a.postalCode ?? a.postal_code ?? '',
    country_code: String(a.country ?? a.country_code ?? 'us').toLowerCase(),
    phone: a.phone ?? '',
    is_default: Boolean(a.isDefault ?? a.is_default),
  };
}

/** UI → API. Empty optional fields go out as null so a cleared field is actually cleared. */
export function addressToApi(a) {
  return {
    firstName: a.first_name || null,
    lastName: a.last_name || null,
    line1: a.address_1 || '',
    line2: a.address_2 || null,
    city: a.city || '',
    province: a.province || null,
    postalCode: a.postal_code || '',
    country: (a.country_code || 'us').toLowerCase(),
    phone: a.phone || null,
  };
}

/** The cart API stores this exact shape on the order. */
export function cartAddressToApi(a) {
  const x = addressToApi(a);
  return { ...x, firstName: x.firstName || '', lastName: x.lastName || '', line2: x.line2 || '', phone: x.phone || '' };
}

export function mapCustomer(c) {
  if (!c) return null;
  return {
    id: c.id,
    email: c.email,
    first_name: c.firstName ?? '',
    last_name: c.lastName ?? '',
    phone: c.phone ?? '',
    addresses: (c.addresses || []).map(addressFromApi),
  };
}

/** API order (placed, confirmed or from history) → what the screens read. */
export function mapOrder(o) {
  if (!o) return null;
  return {
    id: o.id,
    display_id: o.orderNumber,
    email: o.contactEmail ?? o.email ?? '',
    status: o.status,
    total: centsToDollars(o.totalCents),
    currency: o.currency,
    created_at: o.createdAt,
    shipped_at: o.shippedAt,
    tracking_number: o.trackingNumber,
    tracking_url: safeUrl(o.trackingUrl),
    noPaymentRequired: !!o.noPaymentRequired,
    paidWithStoredValue: !!o.paidWithStoredValue,
    items: (o.items || []).map((i) => ({
      title: i.productName,
      variant: i.variantName,
      quantity: i.quantity,
      total: centsToDollars(i.lineTotalCents),
    })),
  };
}

// ── Cart ────────────────────────────────────────────────────────────────────
// The cart id is an unguessable UUID and acts as the bearer token, so it is
// held in localStorage.

export async function createCart() {
  const { cart } = await api(`/${SHOP_ID}/carts`, { method: 'POST' });
  return cart;
}

export async function getCart(cartId) {
  const { cart } = await api(`/carts/${cartId}`);
  return cart;
}

export async function addToCart(cartId, variantId, quantity = 1) {
  const { cart } = await api(`/carts/${cartId}/items`, {
    method: 'POST',
    body: JSON.stringify({ variantId, quantity }),
  });
  return cart;
}

export async function updateCartItem(cartId, itemId, quantity) {
  const { cart } = await api(`/carts/${cartId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
  return cart;
}

/** May resolve with no cart (an emptied cart); callers re-read it in that case. */
export async function removeCartItem(cartId, itemId) {
  const { cart } = await api(`/carts/${cartId}/items/${itemId}`, { method: 'DELETE' });
  return cart;
}

export async function updateCartDetails(cartId, details) {
  const { cart } = await api(`/carts/${cartId}`, { method: 'PATCH', body: JSON.stringify(details) });
  return cart;
}

/**
 * Cancel the open payment attempt so the cart can be edited again.
 *
 * ⚠️ THIS RETURNS A NEW CART WITH A NEW ID. The engine freezes a cart the
 * moment payment is prepared and the only way back to an editable state is a
 * replacement cart carrying the same items. Callers MUST adopt `cart.id`.
 */
export async function restartCheckout(cartId) {
  const { cart } = await api(`/carts/${cartId}/restart`, {
    method: 'POST',
    body: JSON.stringify({ confirmCancelPayment: true }),
  });
  return cart;
}

/**
 * Apply (or, with "", remove) a discount code. Returns the recalculated cart and
 * what happened to the code: { code, applied } or { code, applied: false, message }.
 * The message is the store's own wording and never says whether a code exists.
 */
export async function applyDiscountCode(cartId, code) {
  const { cart, discount } = await api(`/carts/${cartId}`, { method: 'PATCH', body: JSON.stringify({ discountCode: code }) });
  return { cart, discount: discount ?? null };
}

/** Cart totals in DOLLARS, for direct display. */
export function cartTotals(cart) {
  return {
    subtotal: centsToDollars(cart?.subtotalCents),
    discount: centsToDollars(cart?.discountCents),
    tax: centsToDollars(cart?.taxCents),
    shipping: centsToDollars(cart?.shippingCents),
    total: centsToDollars(cart?.totalCents),
    storedValue: centsToDollars(cart?.storedValueCents),
    amountDue: centsToDollars(cart?.amountDueCents ?? cart?.totalCents),
  };
}

/**
 * A compact fingerprint of what the shopper is about to pay for. Two carts
 * with the same signature show the same lines, discount and total.
 */
export function cartSignature(cart) {
  if (!cart) return '';
  const lines = (cart.items || []).map((i) => `${i.variantId}x${i.quantity}`).sort().join(',');
  return [cart.totalCents, cart.storedValueCents || 0, cart.discountCode || '', lines].join('|');
}

// ── Checkout ────────────────────────────────────────────────────────────────

/**
 * Start (or resume) payment. Returns the Stripe client secret for the Payment
 * Element. Calling it again for a cart already in checkout returns the SAME
 * intent, repriced — so it is safe to call on every page load.
 *
 * `reviewDigest` is required exactly when a gift card is applied: it proves
 * the shopper reviewed the order with that balance on it.
 */
export async function createPaymentIntent(cartId, reviewDigest) {
  return api(`/carts/${cartId}/payment-intent`, {
    method: 'POST',
    body: JSON.stringify(reviewDigest ? { reviewDigest } : {}),
  });
}

/** Finalize after payment; assigns the real order number. */
export async function completeOrder(cartId) {
  const { order } = await api(`/carts/${cartId}/complete`, { method: 'POST' });
  return mapOrder(order);
}

/**
 * `completeOrder`, patient about the payment webhook.
 *
 * Stripe has confirmed the payment by the time we get here, but the order only
 * becomes "paid" when Stripe's webhook reaches the engine — usually under a
 * second, occasionally several. Until then `/complete` answers 409
 * PAYMENT_REQUIRED, which here means "not yet", not "no". Retrying is correct;
 * showing an error would tell a customer who has paid that they have not.
 *
 * Gives up after ~15 s with code ORDER_PENDING. Any OTHER error is real and
 * is thrown at once.
 */
export async function completeOrderWithRetry(cartId, { tries = 10 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      return await completeOrder(cartId);
    } catch (e) {
      if (e.code !== 'PAYMENT_REQUIRED' && e.code !== 'PAYMENT_CONFIRMATION_REQUIRED') throw e;
      if (i === tries - 1) break;
      await sleep(Math.min(2500, 700 + i * 300));
    }
  }
  const err = new Error('Your payment went through and we’re confirming your order.');
  err.code = 'ORDER_PENDING';
  throw err;
}

/** Place a reviewed order whose total is $0 (a fully discounted cart). */
export async function placeZeroTotalOrder(cartId, reviewDigest) {
  const { order } = await api(`/carts/${cartId}/place-zero-total`, {
    method: 'POST',
    body: JSON.stringify({ confirmNoPayment: true, reviewDigest }),
  });
  return mapOrder(order);
}

/** Place a reviewed order that a gift card covers in full. */
export async function placeStoredValueOrder(cartId, reviewDigest) {
  const { order } = await api(`/carts/${cartId}/place-stored-value`, {
    method: 'POST',
    body: JSON.stringify({ confirmStoredValue: true, reviewDigest }),
  });
  return mapOrder(order);
}

/**
 * Hold a gift card's balance against the cart. Works for guests.
 *
 * ⚠️ ANY later change to the cart (address, email, discount code) RELEASES the
 * hold — the engine makes the shopper re-review a changed order — so apply the
 * gift card LAST and re-apply it after every cart edit. The code is a bearer
 * secret: keep it in memory only, never in storage, a URL or a log.
 */
export async function applyGiftCard(cartId, giftCode) {
  const { cart } = await api(`/carts/${cartId}/stored-value`, {
    method: 'POST',
    body: JSON.stringify({ kind: 'gift_card', giftCode }),
  });
  return cart;
}

export async function removeStoredValue(cartId) {
  const { cart } = await api(`/carts/${cartId}/stored-value`, { method: 'DELETE' });
  return cart;
}

/** Gift card codes are `NVG_` + 43 URL-safe base64 characters. */
export const GIFT_CODE_RE = /^NVG_[A-Za-z0-9_-]{43}$/;

/** Guest order lookup by order number + the email on the order. */
export async function lookupOrder(orderNumber, email) {
  const { order } = await api(`/${SHOP_ID}/orders/lookup`, {
    method: 'POST',
    body: JSON.stringify({ orderNumber, email }),
  });
  return mapOrder(order);
}

// ── Customer accounts ───────────────────────────────────────────────────────
// The session token is held in localStorage under TOKEN_KEY. It is scoped to
// THIS shop by the server: a token minted here is refused at another store.

export const TOKEN_KEY = 'site-shop-token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function registerCustomer({ email, password, first_name, last_name }) {
  const { token, customer } = await api(`/${SHOP_ID}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password, firstName: first_name, lastName: last_name }),
  });
  setToken(token);
  return customer;
}

export async function loginCustomer(email, password) {
  const { token, customer } = await api(`/${SHOP_ID}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
  return customer;
}

export function logoutCustomer() {
  setToken(null);
}

/** Current shopper (UI-shaped, addresses included), or null when signed out / expired. Never throws. */
export async function retrieveCustomer() {
  if (!getToken()) return null;
  try {
    const { customer } = await api(`/${SHOP_ID}/customers/me`, { headers: authHeaders() });
    return mapCustomer(customer);
  } catch (e) {
    // An expired or invalid session should log the shopper out cleanly rather
    // than leaving a dead token that fails every subsequent call.
    if (e.status === 401) setToken(null);
    return null;
  }
}

export async function listCustomerOrders() {
  const { orders } = await api(`/${SHOP_ID}/customers/me/orders`, { headers: authHeaders() });
  return (orders || []).map(mapOrder);
}

/** Take UI-shaped addresses; return the saved one, UI-shaped. */
export async function createCustomerAddress(address) {
  const { address: a } = await api(`/${SHOP_ID}/customers/me/addresses`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(addressToApi(address)),
  });
  return addressFromApi(a);
}

export async function updateCustomerAddress(addressId, address) {
  const { address: a } = await api(`/${SHOP_ID}/customers/me/addresses/${addressId}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(addressToApi(address)),
  });
  return addressFromApi(a);
}

export async function setDefaultCustomerAddress(addressId) {
  const { address: a } = await api(`/${SHOP_ID}/customers/me/addresses/${addressId}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ isDefault: true }),
  });
  return addressFromApi(a);
}

export async function deleteCustomerAddress(addressId) {
  await api(`/${SHOP_ID}/customers/me/addresses/${addressId}`, {
    method: 'DELETE', headers: authHeaders(),
  });
}

/** Attach the current guest cart to the signed-in shopper. */
export async function claimCartForCustomer(cartId) {
  if (!getToken()) return null;
  const { cart } = await api(`/${SHOP_ID}/carts/${cartId}/claim`, {
    method: 'POST', headers: authHeaders(),
  });
  return cart;
}

// ── Wishlist (signed-in half; guests use localStorage) ──────────────────────
// Every call returns the account's full list as mapped products, so the caller
// replaces its state instead of patching it.

const wishlistProducts = (res) => (res.items || []).filter((i) => i.product).map((i) => mapShopProduct(i.product));

export async function fetchWishlist() {
  return wishlistProducts(await api(`/${SHOP_ID}/customers/me/wishlist`, { headers: authHeaders() }));
}

export async function addWishlistItem(productId) {
  return wishlistProducts(await api(`/${SHOP_ID}/customers/me/wishlist/${encodeURIComponent(productId)}`, {
    method: 'PUT', headers: authHeaders(),
  }));
}

export async function removeWishlistItem(productId) {
  return wishlistProducts(await api(`/${SHOP_ID}/customers/me/wishlist/${encodeURIComponent(productId)}`, {
    method: 'DELETE', headers: authHeaders(),
  }));
}

/** Merge a guest's local list into the account's on sign-in. MERGE, never replace. */
export async function mergeWishlist(productIds) {
  return wishlistProducts(await api(`/${SHOP_ID}/customers/me/wishlist/merge`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ productIds }),
  }));
}
