'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  SHOP_API, SHOP_ID, fetchCatalog, createCart, getCart, addToCart, updateCartItem, removeCartItem,
  applyDiscountCode, shopErrorMessage,
} from '@/lib/shop';

const CartContext = createContext(null);

// NEW KEY on purpose: cart ids from the old Medusa backend mean nothing to this
// engine, so a returning visitor gets a fresh cart instead of looping on a 404.
const CART_KEY = 'site-shop-cart-id';

/** The saved cart no longer accepts changes: checked out, expired or reaped. */
const cartIsGone = (e) => e?.status === 404 && e?.code === 'NOT_FOUND';

/**
 * Cart state, backed by the Nexvato Shop engine.
 *
 * The PUBLIC API of this provider is unchanged — add(productId, qty),
 * setQty(lineId, delta), remove(lineId), clear(), items, cartCount, subtotal,
 * shipMsg, openCart/closeCart — so CartDrawer, the PDP and the product cards
 * needed no changes at all. Since support #142/#143 it also exposes
 * `cartError` (why the last change was refused), `add` resolves true/false,
 * and `applyDiscount(code)` + `discount`/`discountCode` drive the code field.
 *
 * ⚠️ UNITS: the API speaks CENTS. Everything this provider exposes is in
 * DOLLARS, because that is what the components have always consumed. The
 * conversion happens once, in `items`.
 */
export default function CartProvider({ children }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [cart, setCart] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Why the last cart change was refused, in the server's words. Shown at the
  // top of the cart drawer; cleared by the next successful change or by
  // closing the drawer.
  const [cartError, setCartError] = useState('');
  const busy = useRef(false);

  // Load catalog once.
  useEffect(() => {
    let alive = true;
    fetchCatalog().then((list) => {
      if (alive) { setCatalog(list); setCatalogLoading(false); }
    });
    return () => { alive = false; };
  }, []);

  const refreshCart = useCallback(async (id) => {
    try {
      const c = await getCart(id);
      // A cart that has been checked out is no longer a cart — drop it so the
      // shopper starts clean rather than editing a placed order.
      if (c?.status && c.status !== 'draft') {
        try { localStorage.removeItem(CART_KEY); } catch {}
        setCart(null);
        return null;
      }
      setCart(c);
      return c;
    } catch {
      // stale / expired / reaped cart — drop it
      try { localStorage.removeItem(CART_KEY); } catch {}
      setCart(null);
      return null;
    }
  }, []);

  // Rehydrate an existing cart on mount.
  useEffect(() => {
    let id = null;
    try { id = localStorage.getItem(CART_KEY); } catch {}
    if (id) refreshCart(id);
  }, [refreshCart]);

  const ensureCart = useCallback(async ({ fresh = false } = {}) => {
    if (cart?.id && !fresh) return cart;
    const c = await createCart();
    try { localStorage.setItem(CART_KEY, c.id); } catch {}
    setCart(c);
    return c;
  }, [cart]);

  /**
   * A cart change the server refused (support #142).
   *
   * WAS: every refusal was swallowed. A 409 — sold out, not enough stock, a
   * checkout already in progress — left the button looking as if it had
   * worked, or opened an unchanged "Your Cart (0)" with no explanation.
   *
   * Now the shopper is told why, in the server's own words, and the cart is
   * re-read from the server so the drawer shows what is REALLY in it rather
   * than what this tab last assumed (another tab, an expired reservation or a
   * half-applied change can all make the local copy wrong).
   *
   * Only re-read when the server actually answered: refreshCart() drops the
   * saved cart on ANY failure, so re-reading after a network blip would throw
   * away a perfectly good cart.
   */
  const reportCartError = useCallback(async (what, err, cartId) => {
    setCartError(err ? `${what}: ${shopErrorMessage(err)}` : what);
    if (cartId && err?.status) await refreshCart(cartId);
    setCartOpen(true);
  }, [refreshCart]);

  /** Adds to the cart. Resolves true when the item is in the cart, false when it was refused. */
  const add = useCallback(async (productId, qty = 1) => {
    if (busy.current) return false;
    const item = catalog.find((p) => p.id === productId);
    if (!item?.variantId) {
      await reportCartError(
        catalogLoading
          ? 'The store is still loading. Try again in a moment.'
          : 'This item can’t be added to your cart right now.',
      );
      return false;
    }
    busy.current = true;
    let c = null;
    try {
      c = await ensureCart();
      try {
        setCart(await addToCart(c.id, item.variantId, qty));
      } catch (e) {
        if (!cartIsGone(e)) throw e;
        // The saved cart was checked out, expired or reaped. Honour the click
        // on a new cart instead of failing every add from here on — the same
        // rule refreshCart() applies on load: a cart that is no longer a draft
        // is no longer this shopper's cart.
        try { localStorage.removeItem(CART_KEY); } catch {}
        setCart(null);
        c = await ensureCart({ fresh: true });
        setCart(await addToCart(c.id, item.variantId, qty));
      }
      setCartError('');
      setCartOpen(true);
      return true;
    } catch (e) {
      // OUT_OF_STOCK is a real, expected answer: the engine refuses to reserve
      // units it does not have rather than overselling. Say so.
      await reportCartError(`Couldn’t add ${item.title}`, e, c?.id);
      return false;
    } finally {
      busy.current = false;
    }
  }, [catalog, catalogLoading, ensureCart, reportCartError]);

  const setQty = useCallback(async (lineId, delta) => {
    if (!cart?.id) return;
    const line = (cart.items || []).find((i) => i.id === lineId);
    if (!line) return;
    const quantity = Math.max(1, line.quantity + delta);
    try {
      setCart(await updateCartItem(cart.id, lineId, quantity));
      setCartError('');
    } catch (e) {
      // Usually a stock refusal on "+", or a line another tab already changed.
      await reportCartError('Couldn’t change the quantity', e, cart.id);
    }
  }, [cart, reportCartError]);

  const remove = useCallback(async (lineId) => {
    if (!cart?.id) return;
    try {
      setCart(await removeCartItem(cart.id, lineId));
      setCartError('');
    } catch (e) {
      await reportCartError('Couldn’t remove that item', e, cart.id);
    }
  }, [cart, reportCartError]);

  /**
   * Apply a discount code, or remove it with an empty string (support #143).
   * Resolves to the server's verdict on the code (see applyDiscountCode);
   * throws when the request itself was refused, e.g. once payment has started.
   */
  const applyDiscount = useCallback(async (code) => {
    if (!cart?.id) throw Object.assign(new Error('Add something to your cart first.'), { code: 'EMPTY_CART' });
    const { cart: next, discount } = await applyDiscountCode(cart.id, (code || '').trim());
    setCart(next);
    return discount;
  }, [cart]);

  const clear = useCallback(async () => {
    try { localStorage.removeItem(CART_KEY); } catch {}
    setCart(null);
  }, []);

  /**
   * Attach the current guest cart to the signed-in shopper so the resulting
   * order lands in their history. No-op when signed out or cartless.
   */
  const claimCart = useCallback(async () => {
    const id = cart?.id;
    if (!id) return;
    let token = null;
    try { token = localStorage.getItem('site-shop-token'); } catch {}
    if (!token) return;
    try {
      await fetch(`${SHOP_API}/${SHOP_ID}/carts/${id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshCart(id);
    } catch { /* not signed in / already claimed — ignore */ }
  }, [cart, refreshCart]);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => { setCartOpen(false); setCartError(''); }, []);

  const items = useMemo(
    () =>
      (cart?.items || []).map((li) => {
        const c = catalog.find((x) => x.variantId === li.variantId) || {};
        // CENTS → DOLLARS, once, here.
        const price = (li.unitPriceCents || 0) / 100;
        return {
          id: li.id,
          productId: c.id,
          brand: c.brand,
          title: li.productName || c.title,
          image: c.image,
          qty: li.quantity,
          price,
          lineTotal: (li.lineTotalCents || 0) / 100,
        };
      }),
    [cart, catalog]
  );

  const cartCount = useMemo(() => items.reduce((t, it) => t + it.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((t, it) => t + it.lineTotal, 0), [items]);
  const shipPct = Math.min(100, Math.round((subtotal / 75) * 100));
  const remaining = Math.max(0, 75 - subtotal);
  const shipMsg =
    subtotal <= 0
      ? 'Free U.S. shipping over $75'
      : remaining > 0
        ? `$${remaining.toFixed(2)} away from free U.S. shipping`
        : 'Free U.S. shipping unlocked';

  const value = {
    catalog,
    catalogLoading,
    cart,
    cartId: cart?.id || null,
    cartOpen,
    cartError,
    items,
    cartCount,
    subtotal,
    // Server-computed, in DOLLARS like everything else here. The code can be
    // saved on the cart without applying (below a minimum, expired, …) — then
    // discount is 0 and the verdict from applyDiscount says why.
    discount: (cart?.discountCents || 0) / 100,
    discountCode: cart?.discountCode || null,
    shipPct,
    remaining,
    shipMsg,
    add,
    setQty,
    remove,
    clear,
    applyDiscount,
    claimCart,
    openCart,
    closeCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}
