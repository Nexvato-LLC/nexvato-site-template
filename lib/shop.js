import { productArt } from '@/lib/data';

/**
 * Nexvato Shop client — replaces the Medusa SDK (lib/medusa.js).
 *
 * WHY THIS EXISTS: the store now runs on Nexvato's own multi-tenant commerce
 * engine instead of a per-client Medusa instance. That means one login for the
 * merchant (they manage this shop inside the Nexvato dashboard), no container
 * fleet to operate, and no second system of record.
 *
 * THE CONTRACT IS UNCHANGED. Every exported function returns the exact shape
 * `mapMedusaProduct` used to return, so the components, pages and providers
 * that consume it did not have to be rewritten.
 *
 * ⚠️ UNITS: this API speaks CENTS (integers). The storefront components speak
 * DOLLARS. The conversion happens HERE, once, in `centsToDollars` — never
 * scattered through components, where a missed division is a 100× price bug.
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

async function api(path, options) {
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
  const res = await fetch(`${SHOP_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Request failed (${res.status})`);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body;
}

/**
 * Map an API product into the shape the storefront already expects.
 * Display-only attributes (brand, tone, rating, badges, specs) ride in
 * `metadata`, which the commerce engine stores but never interprets.
 */
export function mapShopProduct(p) {
  const m = p.metadata || {};
  const variant = (p.variants && p.variants[0]) || {};
  const tone = m.tone || '#1f3a5f';
  const cat = m.cat || p.category?.name || '';
  const brand = m.brand || '';
  return {
    id: p.slug,            // the storefront routes by slug, as it did by handle
    handle: p.slug,
    productId: p.id,
    variantId: variant.id,
    brand,
    title: p.name,
    price: centsToDollars(variant.priceCents),
    compareAt: variant.compareAtCents ? centsToDollars(variant.compareAtCents) : undefined,
    cat,
    tone,
    rating: m.rating != null ? Number(m.rating) : undefined,
    reviews: m.reviews != null ? Number(m.reviews) : 0,
    collectible: !!m.collectible,
    badge: m.badge || undefined,
    badgeVariant: m.badgeVariant || undefined,
    blurb: p.description || m.blurb || undefined,
    specs: Array.isArray(m.specs) ? m.specs : undefined,
    collection: p.category?.slug || null,
    inStock: variant.inStock !== false,
    image: productArt({ tone, cat, brand }),
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

// ── Cart ────────────────────────────────────────────────────────────────────
// The cart id is an unguessable UUID and acts as the bearer token, so it is
// held in localStorage exactly like the old Medusa cart id was.

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

export async function removeCartItem(cartId, itemId) {
  const { cart } = await api(`/carts/${cartId}/items/${itemId}`, { method: 'DELETE' });
  return cart;
}

export async function updateCartDetails(cartId, details) {
  const { cart } = await api(`/carts/${cartId}`, { method: 'PATCH', body: JSON.stringify(details) });
  return cart;
}

/** Cart totals in DOLLARS, for direct display. */
export function cartTotals(cart) {
  return {
    subtotal: centsToDollars(cart?.subtotalCents),
    discount: centsToDollars(cart?.discountCents),
    tax: centsToDollars(cart?.taxCents),
    shipping: centsToDollars(cart?.shippingCents),
    total: centsToDollars(cart?.totalCents),
  };
}

// ── Checkout ────────────────────────────────────────────────────────────────

/**
 * Start payment. Returns the Stripe client secret for the Payment Element —
 * the SAME contract StripePaymentSection.jsx already consumes, so that
 * component is untouched by this migration.
 */
export async function createPaymentIntent(cartId) {
  return api(`/carts/${cartId}/payment-intent`, { method: 'POST' });
}

/** Finalize after payment; assigns the real order number. */
export async function completeOrder(cartId) {
  const { order } = await api(`/carts/${cartId}/complete`, { method: 'POST' });
  return order;
}

/** Guest order lookup by order number + the email on the order. */
export async function lookupOrder(orderNumber, email) {
  const { order } = await api(`/${SHOP_ID}/orders/lookup`, {
    method: 'POST',
    body: JSON.stringify({ orderNumber, email }),
  });
  return order;
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

/** Current shopper, or null when signed out / expired. Never throws. */
export async function retrieveCustomer() {
  if (!getToken()) return null;
  try {
    const { customer } = await api(`/${SHOP_ID}/customers/me`, { headers: authHeaders() });
    return customer;
  } catch (e) {
    // An expired or invalid session should log the shopper out cleanly rather
    // than leaving a dead token that fails every subsequent call.
    if (e.status === 401) setToken(null);
    return null;
  }
}

export async function listCustomerOrders() {
  const { orders } = await api(`/${SHOP_ID}/customers/me/orders`, { headers: authHeaders() });
  return orders || [];
}

export async function createCustomerAddress(address) {
  const { address: a } = await api(`/${SHOP_ID}/customers/me/addresses`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(address),
  });
  return a;
}

export async function updateCustomerAddress(addressId, address) {
  const { address: a } = await api(`/${SHOP_ID}/customers/me/addresses/${addressId}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(address),
  });
  return a;
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
