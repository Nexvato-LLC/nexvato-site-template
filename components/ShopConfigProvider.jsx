'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchShopConfig } from '@/lib/shop';

const ShopConfigContext = createContext({ config: null, refreshConfig: async () => null });

/**
 * The store's live settings (GET /:shopId): free-shipping threshold, payment
 * readiness, business identity and published website copy.
 *
 * `initial` is what the server read for this request, so the first render
 * already has the real values (support #133). After that the settings are
 * re-read, uncached, whenever the shopper comes back to the tab (support
 * #138): a merchant who changes the threshold or finishes payment setup is
 * reflected without a reload, let alone a redeploy.
 *
 * A failed re-read keeps the last good settings for display. Callers that
 * must not act on stale data — checkout deciding whether it may take a
 * payment — use the value `refreshConfig()` resolves, which is null on failure.
 */
export default function ShopConfigProvider({ initial = null, children }) {
  const [config, setConfig] = useState(initial);
  const inFlight = useRef(null);

  const refreshConfig = useCallback(() => {
    // Focus and visibilitychange often fire together; share one request.
    if (!inFlight.current) {
      inFlight.current = fetchShopConfig()
        .then((fresh) => {
          if (fresh) setConfig(fresh);
          return fresh;
        })
        .finally(() => { inFlight.current = null; });
    }
    return inFlight.current;
  }, []);

  useEffect(() => {
    // The server could not read the settings for this render: try once here.
    if (!initial) refreshConfig();
    const onFocus = () => { refreshConfig(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refreshConfig(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // `initial` is the server's answer for the first render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshConfig]);

  return (
    <ShopConfigContext.Provider value={{ config, refreshConfig }}>
      {children}
    </ShopConfigContext.Provider>
  );
}

export function useShopConfig() {
  return useContext(ShopConfigContext);
}
