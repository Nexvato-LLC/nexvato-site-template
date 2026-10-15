'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HAS_COMMERCE } from '@/lib/site-mode';
import { addWishlistItem, removeWishlistItem, fetchWishlist, mergeWishlist } from '@/lib/shop';
import { useAuth } from '@/components/AuthProvider';

const WishlistContext = createContext(null);

// Guests keep their list in this browser. It holds PRODUCT IDS only — no names,
// prices or anything that could go stale.
const GUEST_KEY = 'site-shop-wishlist';

function readGuest() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
function writeGuest(ids) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(ids)); } catch {}
}

/**
 * The wishlist: saved product IDs, remembered across reloads.
 *
 *   Guest      localStorage. No account, no round trip.
 *   Signed in  the shop's wishlist API, so the list follows the shopper to
 *              another device. On sign-in the guest list is MERGED into the
 *              account's (never replacing it) and then cleared locally.
 *
 * Before this the heart toggled React state only: it was forgotten on reload,
 * and the header Wishlist button had nothing to open (support #219).
 *
 * Products themselves are resolved from the catalog the cart provider already
 * loaded, so the saved list needs no extra requests to render.
 */
export default function WishlistProvider({ children }) {
  const { customer, authLoading } = useAuth();
  const customerId = customer?.id || null;
  const [ids, setIds] = useState([]);
  const [ready, setReady] = useState(false);
  // Latest ids for handlers that must not close over a stale list.
  const idsRef = useRef([]);
  const put = useCallback((next) => { idsRef.current = next; setIds(next); }, []);

  // Load (and, on sign-in, merge) whenever the shopper changes.
  useEffect(() => {
    if (!HAS_COMMERCE || authLoading) return undefined;
    let alive = true;
    (async () => {
      if (!customerId) {
        put(readGuest());
        if (alive) setReady(true);
        return;
      }
      try {
        const guest = readGuest();
        const items = guest.length ? await mergeWishlist(guest) : await fetchWishlist();
        if (!alive) return;
        put(items.map((p) => p.productId));
        if (guest.length) writeGuest([]); // merged — don't merge it again next load
      } catch {
        // Offline or a hiccup: show the guest list rather than nothing; it is
        // kept in storage, so the merge is retried on the next load.
        if (alive) put(readGuest());
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [customerId, authLoading, put]);

  // Another tab changed the guest list.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === GUEST_KEY && !customerId) put(readGuest()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [customerId, put]);

  const has = useCallback((productId) => !!productId && ids.includes(productId), [ids]);

  /** Heart on/off. Optimistic; rolled back if the server refuses. */
  const toggle = useCallback(async (productId) => {
    if (!productId) return;
    const before = idsRef.current;
    const saved = before.includes(productId);
    const next = saved ? before.filter((x) => x !== productId) : [...before, productId];
    put(next);
    if (!customerId) { writeGuest(next); return; }
    try {
      const items = saved ? await removeWishlistItem(productId) : await addWishlistItem(productId);
      put(items.map((p) => p.productId));
    } catch {
      put(before);
    }
  }, [customerId, put]);

  const value = useMemo(() => ({ ids, count: ids.length, has, toggle, ready }), [ids, has, toggle, ready]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a <WishlistProvider>');
  return ctx;
}
