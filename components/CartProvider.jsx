'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  SHOP_API, SHOP_ID, fetchCatalog, createCart, getCart, addToCart, updateCartItem, removeCartItem,
} from '@/lib/shop';

const CartContext = createContext(null);

// NEW KEY on purpose: cart ids from the old Medusa backend mean nothing to this
// engine, so a returning visitor gets a fresh cart instead of looping on a 404.
const CART_KEY = 'site-shop-cart-id';

/**
 * Cart state, backed by the Nexvato Shop engine.
 *
 * The PUBLIC API of this provider is unchanged — add(productId, qty),
 * setQty(lineId, delta), remove(lineId), clear(), items, cartCount, subtotal,
 * shipMsg, openCart/closeCart — so CartDrawer, the PDP and the product cards
 * needed no changes at all.
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

  const ensureCart = useCallback(async () => {
    if (cart?.id) return cart;
    const c = await createCart();
    try { localStorage.setItem(CART_KEY, c.id); } catch {}
    setCart(c);
    return c;
  }, [cart]);

  const add = useCallback(async (productId, qty = 1) => {
    const item = catalog.find((p) => p.id === productId);
    if (!item?.variantId || busy.current) return;
    busy.current = true;
    try {
      const c = await ensureCart();
      setCart(await addToCart(c.id, item.variantId, qty));
      setCartOpen(true);
    } catch (e) {
      // OUT_OF_STOCK is a real, expected answer: the engine refuses to reserve
      // units it does not have rather than overselling.
      if (e?.code === 'OUT_OF_STOCK') setCartOpen(true);
    } finally {
      busy.current = false;
    }
  }, [catalog, ensureCart]);

  const setQty = useCallback(async (lineId, delta) => {
    if (!cart?.id) return;
    const line = (cart.items || []).find((i) => i.id === lineId);
    if (!line) return;
    const quantity = Math.max(1, line.quantity + delta);
    try {
      setCart(await updateCartItem(cart.id, lineId, quantity));
    } catch { /* stock refusal or stale line — leave cart state as-is */ }
  }, [cart]);

  const remove = useCallback(async (lineId) => {
    if (!cart?.id) return;
    try {
      setCart(await removeCartItem(cart.id, lineId));
    } catch { /* noop */ }
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
  const closeCart = useCallback(() => setCartOpen(false), []);

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
    items,
    cartCount,
    subtotal,
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
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}
