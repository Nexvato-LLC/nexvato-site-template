'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCatalog, createCart, getCart, addToCart, updateCartItem, removeCartItem,
  restartCheckout, claimCartForCustomer,
} from '@/lib/shop';
import { useShopConfig } from '@/components/ShopConfigProvider';

const CartContext = createContext(null);

// NEW KEY on purpose: cart ids from an older backend mean nothing to this
// engine, so a returning visitor gets a fresh cart instead of looping on a 404.
const CART_KEY = 'site-shop-cart-id';
// Bumped on every cart change so OTHER tabs hear about it. The cart id itself
// does not change when an item is added, so the id key alone would never fire
// a `storage` event for that (support #221).
const PING_KEY = 'site-shop-cart-ping';

const SLOW_DOWN = 'Slow down a moment and try again.';
const LOCKED = 'Your payment is being processed, so the cart can’t be changed right now.';

/** A refusal because there isn't enough stock (the API's OUT_OF_STOCK, or a bare 409 from an older API). */
const isStockError = (e) => e?.code === 'OUT_OF_STOCK' || (e?.status === 409 && !e?.code);
/** The cart is mid-payment and the shopper's payment attempt can't be cancelled to edit it. */
const isLockedError = (e) => ['CHECKOUT_REVIEW_REQUIRED', 'CHECKOUT_NOT_RESTARTABLE', 'CHECKOUT_IN_PROGRESS', 'CHECKOUT_CHANGED', 'CHECKOUT_DETAILS_FROZEN'].includes(e?.code);
const fmtMoney = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const readStoredId = () => { try { return localStorage.getItem(CART_KEY); } catch { return null; } };
const writeStoredId = (id) => { try { id ? localStorage.setItem(CART_KEY, id) : localStorage.removeItem(CART_KEY); } catch {} };
const broadcast = () => { try { localStorage.setItem(PING_KEY, String(Date.now())); } catch {} };

/**
 * What to tell the shopper when adding to the cart fails. Returns
 * { message, available }.
 *
 * "Out of stock" is only true when the API says nothing is left
 * (`available === 0`). Before this, EVERY 409 said "out of stock right now" —
 * including a request for 121 units of a product with 7 in stock, which sent
 * customers away from a product they could have bought (support #228).
 */
function describeAddError(e, title) {
  const name = title || 'that item';
  if (e?.status === 429) return { message: SLOW_DOWN };
  if (isLockedError(e)) return { message: LOCKED };
  if (isStockError(e)) {
    // On POST /items, `available` is how many units can still be ADDED.
    if (typeof e.available === 'number') {
      if (e.available <= 0) return { message: `Sorry, ${name} is out of stock right now.`, available: 0 };
      return {
        message: `Only ${e.available} left in stock. We didn’t add anything — choose ${e.available} or fewer.`,
        available: e.available,
      };
    }
    // An API that does not say how many are left: be honest about not knowing.
    return { message: `There isn’t enough stock of ${name} to add that many. Try a smaller quantity.` };
  }
  if (e?.code === 'NETWORK') return { message: e.message };
  return { message: `We couldn’t add ${name} to your cart. Please try again.` };
}

/**
 * Cart state, backed by the Nexvato Shop engine.
 *
 * Public API: add(productId, qty, variantId?), setQty(lineId, delta),
 * remove(lineId), clear(), items, cartCount, subtotal, shipMsg,
 * openCart/closeCart, refreshCart, plus `cart` (the raw server cart) for
 * checkout.
 *
 * ⚠️ UNITS: the API speaks CENTS. Everything this provider exposes is in
 * DOLLARS, because that is what the components have always consumed. The
 * conversion happens once, in `items`.
 */
export default function CartProvider({ children }) {
  const { config } = useShopConfig();
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [cart, setCart] = useState(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  // Why the last cart action didn't land, shown in the drawer. Cleared on success.
  const [cartNotice, setCartNotice] = useState(null);
  // lineId → the highest quantity the API has accepted, learned from a stock
  // refusal. Drives the disabled "+" in the drawer. Reset whenever the cart is
  // re-read, because stock frees up as other shoppers' carts expire.
  const [limits, setLimits] = useState({});
  const busy = useRef(false);
  // The latest cart for async handlers, which would otherwise close over a stale one.
  const cartRef = useRef(null);

  const putCart = useCallback((c) => { cartRef.current = c; setCart(c); }, []);

  // Load catalog once.
  useEffect(() => {
    let alive = true;
    fetchCatalog().then((list) => {
      if (alive) { setCatalog(list); setCatalogLoading(false); }
    });
    return () => { alive = false; };
  }, []);

  const dropCart = useCallback(() => { writeStoredId(null); putCart(null); setLimits({}); }, [putCart]);

  /**
   * Re-read a cart from the server (default: the current one).
   *
   * Only a definite "gone" (404) drops the cart. A failed request (offline,
   * 5xx) keeps what we have: the old code dropped the cart on ANY error, so a
   * blip silently emptied a shopper's cart.
   *
   * A cart in `pending_payment` is KEPT: it is mid-checkout, and dropping it
   * on reload left the shopper with an empty cart while their payment — and
   * the stock reserved for it — was still live. Checkout resumes from it.
   */
  const refreshCart = useCallback(async (idArg) => {
    let id = idArg || cartRef.current?.id || readStoredId();
    if (!id) return null;
    try {
      let c = await getCart(id);
      // A checkout restarted elsewhere (another tab) hands the cart on.
      for (let hop = 0; hop < 2 && c?.status === 'cancelled' && c.replacementCartId; hop++) {
        id = c.replacementCartId;
        writeStoredId(id);
        c = await getCart(id);
      }
      if (!c || !['draft', 'pending_payment'].includes(c.status)) {
        // Placed, cancelled or expired: it is no longer a cart.
        dropCart();
        return null;
      }
      writeStoredId(c.id);
      setLimits({});
      putCart(c);
      return c;
    } catch (e) {
      if (e.status === 404) { dropCart(); return null; }
      return cartRef.current;
    }
  }, [dropCart, putCart]);

  // Rehydrate an existing cart on mount.
  useEffect(() => {
    const id = readStoredId();
    if (!id) { setCartLoading(false); return; }
    refreshCart(id).finally(() => setCartLoading(false));
  }, [refreshCart]);

  // Keep every open tab on the same cart (support #221). A checkout left open
  // in one tab otherwise goes on showing — and charging — the old cart after
  // the shopper changes it in another.
  useEffect(() => {
    let timer;
    const resync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const id = readStoredId();
        if (!id) { if (cartRef.current) putCart(null); return; }
        refreshCart(id);
      }, 150);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') resync(); };
    const onStorage = (e) => { if (e.key === null || e.key === CART_KEY || e.key === PING_KEY) resync(); };
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshCart, putCart]);

  const ensureCart = useCallback(async () => {
    if (cartRef.current?.id) return cartRef.current;
    const c = await createCart();
    writeStoredId(c.id);
    putCart(c);
    return c;
  }, [putCart]);

  /**
   * A cart in `pending_payment` is frozen. Changing it means cancelling the open
   * payment attempt, which hands back a REPLACEMENT cart with the same items
   * and a new id. Fails (and says so) if the payment is already going through.
   */
  const unlockForEdit = useCallback(async (c) => {
    if (c?.status !== 'pending_payment') return c;
    const next = await restartCheckout(c.id);
    writeStoredId(next.id);
    putCart(next);
    return next;
  }, [putCart]);

  const add = useCallback(async (productId, qty = 1, variantId) => {
    const item = catalog.find((p) => p.id === productId);
    const vId = variantId || item?.variantId;
    if (!vId) return { ok: false };
    if (busy.current) return { ok: false, busy: true };
    busy.current = true;
    try {
      let c = await unlockForEdit(await ensureCart());
      let next;
      try {
        next = await addToCart(c.id, vId, qty);
      } catch (e) {
        // The stored cart expired or was placed: start a fresh one and retry once.
        if (e.status !== 404) throw e;
        dropCart();
        c = await ensureCart();
        next = await addToCart(c.id, vId, qty);
      }
      putCart(next);
      broadcast();
      setLimits({});
      setCartNotice(null);
      setCartOpen(true);
      return { ok: true };
    } catch (e) {
      const { message, available } = describeAddError(e, item?.title);
      setCartNotice(message);
      setCartOpen(true);
      return { ok: false, available, code: e.code };
    } finally {
      busy.current = false;
    }
  }, [catalog, ensureCart, unlockForEdit, dropCart, putCart]);

  const setQty = useCallback(async (lineId, delta) => {
    let c = cartRef.current;
    if (!c?.id) return;
    const line = (c.items || []).find((i) => i.id === lineId);
    if (!line) return;
    const quantity = Math.max(1, line.quantity + delta);
    if (quantity === line.quantity) return;
    const name = line.productName || 'that item';
    try {
      c = await unlockForEdit(c);
      // A restart gives every line a new id; find ours again by its variant.
      const current = c.items.find((i) => i.variantId === line.variantId);
      if (!current) return;
      const next = await updateCartItem(c.id, current.id, quantity);
      putCart(next);
      broadcast();
      setCartNotice(null);
    } catch (e) {
      if (e.status === 429) { setCartNotice(SLOW_DOWN); return; }
      if (isLockedError(e)) { setCartNotice(LOCKED); return; }
      if (isStockError(e)) {
        // On PATCH /items/:id, `available` is the LARGEST quantity this line can
        // be set to. Without it, all we know is that +1 was refused, so the
        // current quantity is the ceiling.
        const max = Math.max(1, typeof e.available === 'number' ? e.available : line.quantity);
        setLimits((l) => ({ ...l, [lineId]: max }));
        setCartNotice(`Only ${max} of ${name} available right now.`);
        return;
      }
      if (e.status === 404) {
        await refreshCart();
        setCartNotice('Your cart was out of date, so we refreshed it. Please check it and try again.');
        return;
      }
      setCartNotice(`We couldn’t update the quantity of ${name}. Please try again.`);
    }
  }, [unlockForEdit, putCart, refreshCart]);

  const remove = useCallback(async (lineId) => {
    let c = cartRef.current;
    if (!c?.id) return;
    const line = (c.items || []).find((i) => i.id === lineId);
    if (!line) return;
    try {
      c = await unlockForEdit(c);
      const current = c.items.find((i) => i.variantId === line.variantId);
      if (!current) return;
      const next = await removeCartItem(c.id, current.id);
      // Removing the LAST line can come back without a cart body. Re-read it
      // rather than guess — an emptied cart is a valid cart, not an error.
      if (next && Array.isArray(next.items)) putCart(next);
      else await refreshCart(c.id);
      broadcast();
      setCartNotice(null);
    } catch (e) {
      // Never swallow this: a silent failure left an item stuck in the cart,
      // holding stock, with no hint why (support #211).
      setCartNotice(e.status === 429
        ? SLOW_DOWN
        : isLockedError(e) ? LOCKED : `We couldn’t remove ${line.productName || 'that item'}. Please try again.`);
    }
  }, [unlockForEdit, putCart, refreshCart]);

  const clear = useCallback(async () => { dropCart(); broadcast(); }, [dropCart]);

  /**
   * Attach the current guest cart to the signed-in shopper so the resulting
   * order lands in their history. No-op when signed out or cartless.
   */
  const claimCart = useCallback(async () => {
    const id = cartRef.current?.id;
    if (!id) return;
    try {
      const claimed = await claimCartForCustomer(id);
      if (claimed) await refreshCart(id);
    } catch { /* not signed in / already claimed — ignore */ }
  }, [refreshCart]);

  /** Make `c` the current cart (a restart hands back a replacement with a new id). */
  const adoptCart = useCallback((c) => {
    if (!c?.id) return;
    writeStoredId(c.id);
    putCart(c);
  }, [putCart]);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => { setCartOpen(false); setCartNotice(null); }, []);

  // variantId → { product, variant } so a line for any variant gets its product's art.
  const byVariant = useMemo(() => {
    const m = new Map();
    for (const p of catalog) {
      for (const v of p.variants || []) m.set(v.id, p);
      if (p.variantId && !m.has(p.variantId)) m.set(p.variantId, p);
    }
    return m;
  }, [catalog]);

  const items = useMemo(
    () =>
      (cart?.items || []).map((li) => {
        const c = byVariant.get(li.variantId) || {};
        // CENTS → DOLLARS, once, here.
        const price = (li.unitPriceCents || 0) / 100;
        return {
          id: li.id,
          productId: c.id,
          variantId: li.variantId,
          brand: c.brand,
          title: li.productName || c.title,
          variantName: li.variantName && li.variantName !== li.productName ? li.variantName : '',
          image: c.image,
          qty: li.quantity,
          price,
          lineTotal: (li.lineTotalCents || 0) / 100,
          maxQty: limits[li.id],
        };
      }),
    [cart, byVariant, limits]
  );

  const cartCount = useMemo(() => items.reduce((t, it) => t + it.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((t, it) => t + it.lineTotal, 0), [items]);

  // The free-shipping goal comes from the SHOP (its real rule), never a number
  // typed into this file: a merchant who changes it in the dashboard would
  // otherwise leave the progress bar and the "$X away" nudge quietly wrong.
  const threshold = config?.freeShippingThreshold || null;
  const hasShipGoal = !!threshold;
  const shipPct = hasShipGoal ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 0;
  const remaining = hasShipGoal ? Math.max(0, threshold - subtotal) : 0;
  const shipMsg = !hasShipGoal
    ? 'Shipping calculated at checkout'
    : subtotal <= 0
      ? `Free U.S. shipping over $${fmtMoney(threshold)}`
      : remaining > 0
        ? `$${remaining.toFixed(2)} away from free U.S. shipping`
        : 'Free U.S. shipping unlocked';

  const value = {
    catalog,
    catalogLoading,
    cart,
    cartId: cart?.id || null,
    cartLoading,
    cartOpen,
    cartNotice,
    items,
    cartCount,
    subtotal,
    hasShipGoal,
    shipPct,
    remaining,
    shipMsg,
    add,
    setQty,
    remove,
    clear,
    claimCart,
    openCart,
    closeCart,
    refreshCart,
    adoptCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}
