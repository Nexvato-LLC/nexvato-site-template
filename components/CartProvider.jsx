'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  SHOP_API, SHOP_ID, fetchCatalog, createCart, getCart, addToCart, updateCartItem, removeCartItem,
  applyDiscountCode, shopErrorMessage,
} from '@/lib/shop';
import { useShopConfig } from '@/components/ShopConfigProvider';
import { freeShippingProgress } from '@/lib/shipping';

const CartContext = createContext(null);

// NEW KEY on purpose: cart ids from the old Medusa backend mean nothing to this
// engine, so a returning visitor gets a fresh cart instead of looping on a 404.
const CART_KEY = 'site-shop-cart-id';

/** The saved cart no longer accepts changes: checked out, expired or reaped. */
const cartIsGone = (e) => e?.status === 404 && e?.code === 'NOT_FOUND';

/**
 * A cart is still the shopper's while it is a draft, or while a payment is
 * prepared for it (`pending_payment`). The second case must survive a refresh
 * (support #135): it was dropped as if completed, which threw away a checkout
 * whose payment form was already open.
 */
const isOpenCart = (c) => c?.status === 'draft' || c?.status === 'pending_payment';

const PAYMENT_STARTED =
  'Payment has started for this cart. Open checkout and choose “Change details” before editing your items.';

/**
 * Cart state, backed by the Nexvato Shop engine.
 *
 * The PUBLIC API of this provider is unchanged — add(productId, qty),
 * setQty(lineId, delta), remove(lineId), clear(), items, cartCount, subtotal,
 * shipMsg, openCart/closeCart — so CartDrawer, the PDP and the product cards
 * needed no changes at all. Since support #142/#143 it also exposes
 * `cartError` (why the last change was refused), `add` resolves true/false
 * and takes an optional variant id, and `applyDiscount(code)` +
 * `discount`/`discountCode` drive the code field. Checkout uses `adoptCart`
 * when the server hands it a replacement cart.
 *
 * ⚠️ UNITS: the API speaks CENTS. Everything this provider exposes is in
 * DOLLARS, because that is what the components have always consumed. Money is
 * the server cart's; nothing here re-adds line totals.
 */
export default function CartProvider({ children }) {
  const { config } = useShopConfig();
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [cart, setCart] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Why the last cart change was refused, in the server's words. Shown at the
  // top of the cart drawer; cleared by the next successful change or by
  // closing the drawer.
  const [cartError, setCartError] = useState('');
  // False until the saved cart (if any) has been read back, so pages can tell
  // "still loading" from "empty".
  const [cartReady, setCartReady] = useState(false);
  const busy = useRef(false);

  // Load catalog once.
  useEffect(() => {
    let alive = true;
    fetchCatalog().then((list) => {
      if (alive) { setCatalog(list); setCatalogLoading(false); }
    });
    return () => { alive = false; };
  }, []);

  const forgetCart = useCallback(() => {
    try { localStorage.removeItem(CART_KEY); } catch {}
    setCart(null);
  }, []);

  /** Make `c` the shopper's cart (e.g. the replacement a checkout restart returns). */
  const adoptCart = useCallback((c) => {
    if (!c?.id) return;
    try { localStorage.setItem(CART_KEY, c.id); } catch {}
    setCart(c);
  }, []);

  const refreshCart = useCallback(async (id) => {
    try {
      const c = await getCart(id);
      // A cart that has been checked out is no longer a cart — drop it so the
      // shopper starts clean rather than editing a placed order.
      if (!isOpenCart(c)) {
        forgetCart();
        return null;
      }
      setCart(c);
      return c;
    } catch (e) {
      // Only the server saying the cart is gone drops it. A network blip must
      // not throw away a perfectly good cart (and its checkout).
      if (cartIsGone(e)) forgetCart();
      return null;
    }
  }, [forgetCart]);

  // Rehydrate an existing cart on mount.
  useEffect(() => {
    let id = null;
    try { id = localStorage.getItem(CART_KEY); } catch {}
    if (id) refreshCart(id).finally(() => setCartReady(true));
    else setCartReady(true);
  }, [refreshCart]);

  const ensureCart = useCallback(async ({ fresh = false } = {}) => {
    if (cart?.id && !fresh) return cart;
    const c = await createCart();
    adoptCart(c);
    return c;
  }, [cart, adoptCart]);

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
   * Only re-read when the server actually answered.
   */
  const reportCartError = useCallback(async (what, err, cartId) => {
    setCartError(err ? `${what}: ${shopErrorMessage(err)}` : what);
    if (cartId && err?.status) await refreshCart(cartId);
    setCartOpen(true);
  }, [refreshCart]);

  /**
   * Adds to the cart. `variantId` defaults to the product's first buyable
   * variant. Resolves true when the item is in the cart, false when refused.
   */
  const add = useCallback(async (productId, qty = 1, variantId) => {
    if (busy.current) return false;
    const item = catalog.find((p) => p.id === productId);
    const vid = variantId || item?.variantId;
    if (!vid) {
      await reportCartError(
        catalogLoading
          ? 'The store is still loading. Try again in a moment.'
          : 'This item can’t be added to your cart right now.',
      );
      return false;
    }
    const title = item?.title || 'that item';
    if (cart?.status === 'pending_payment') {
      await reportCartError(PAYMENT_STARTED);
      return false;
    }
    busy.current = true;
    let c = null;
    try {
      c = await ensureCart();
      try {
        setCart(await addToCart(c.id, vid, qty));
      } catch (e) {
        if (!cartIsGone(e)) throw e;
        // The engine only adds to a draft. Find out what the saved cart is now.
        const current = await refreshCart(c.id);
        if (current?.status === 'pending_payment') {
          await reportCartError(PAYMENT_STARTED);
          return false;
        }
        // Checked out, expired or reaped. Honour the click on a new cart
        // instead of failing every add from here on.
        forgetCart();
        c = await ensureCart({ fresh: true });
        setCart(await addToCart(c.id, vid, qty));
      }
      setCartError('');
      setCartOpen(true);
      return true;
    } catch (e) {
      // OUT_OF_STOCK is a real, expected answer: the engine refuses to reserve
      // units it does not have rather than overselling. Say so.
      await reportCartError(`Couldn’t add ${title}`, e, c?.id);
      return false;
    } finally {
      busy.current = false;
    }
  }, [catalog, catalogLoading, cart, ensureCart, refreshCart, forgetCart, reportCartError]);

  const setQty = useCallback(async (lineId, delta) => {
    if (!cart?.id) return;
    if (cart.status === 'pending_payment') { await reportCartError(PAYMENT_STARTED); return; }
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
    if (cart.status === 'pending_payment') { await reportCartError(PAYMENT_STARTED); return; }
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
    forgetCart();
  }, [forgetCart]);

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
        const c = catalog.find((x) => (x.variants || []).some((v) => v.id === li.variantId)) || {};
        const v = (c.variants || []).find((x) => x.id === li.variantId);
        // CENTS → DOLLARS, once, here.
        const price = (li.unitPriceCents || 0) / 100;
        return {
          id: li.id,
          productId: c.id,
          brand: c.brand,
          title: li.productName || c.title,
          // Only a real choice is worth naming; a single-variant product's
          // variant is usually called "Standard"/"Default".
          variant: c.variants?.length > 1 ? li.variantName : '',
          image: v?.imageUrl || c.image,
          qty: li.quantity,
          price,
          lineTotal: (li.lineTotalCents || 0) / 100,
        };
      }),
    [cart, catalog]
  );

  const cartCount = useMemo(() => items.reduce((t, it) => t + it.qty, 0), [items]);
  // The server's subtotal (before discounts), not a re-addition of lines.
  const subtotal = (cart?.subtotalCents || 0) / 100;
  // Free shipping is judged on the subtotal AFTER discounts, exactly as the
  // server does, against the store's configured threshold (support #138).
  const ship = freeShippingProgress(config, (cart?.subtotalCents || 0) - (cart?.discountCents || 0));

  const value = {
    catalog,
    catalogLoading,
    cart,
    cartId: cart?.id || null,
    cartReady,
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
    // Free-shipping progress; all empty/null when the store makes no promise.
    shipPct: ship ? ship.pct : 0,
    remaining: ship ? ship.remainingCents / 100 : null,
    shipMsg: ship ? ship.message : '',
    shipUnlocked: !!ship?.unlocked,
    add,
    setQty,
    remove,
    clear,
    applyDiscount,
    adoptCart,
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
