'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IS_CONNECTED, fetchShopConfig } from '@/lib/shop';
import { resolveBrand } from '@/lib/brand';

const ShopConfigContext = createContext({ config: null, brand: resolveBrand(null, false), refresh: async () => null, configLoading: false });

/**
 * The shop's runtime config (name, logo, Stripe key, shipping rules, whether
 * it is taking payments) for every client component.
 *
 * The root layout fetches it on the server (so the HTML title, header and
 * footer are right on first paint) and hands it in as `initialConfig`. On
 * mount we fetch it AGAIN, uncached: the server copy may be a minute old, and
 * checkout must never decide "payments are on" from stale data.
 */
export default function ShopConfigProvider({ initialConfig, children }) {
  const [config, setConfig] = useState(initialConfig || null);
  const [configLoading, setConfigLoading] = useState(IS_CONNECTED);

  const refresh = useCallback(async () => {
    const fresh = await fetchShopConfig({ fresh: true });
    // Keep the last good config on a failed refresh rather than blanking the
    // brand and the checkout state because of one dropped request.
    if (fresh) setConfig(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (!IS_CONNECTED) return undefined;
    let alive = true;
    refresh().finally(() => { if (alive) setConfigLoading(false); });
    return () => { alive = false; };
  }, [refresh]);

  const brand = useMemo(() => resolveBrand(config, IS_CONNECTED), [config]);
  const value = useMemo(() => ({ config, brand, refresh, configLoading }), [config, brand, refresh, configLoading]);
  return <ShopConfigContext.Provider value={value}>{children}</ShopConfigContext.Provider>;
}

export function useShopConfig() {
  return useContext(ShopConfigContext);
}

/** Shorthand for components that only need the brand. */
export function useBrand() {
  return useContext(ShopConfigContext).brand;
}
