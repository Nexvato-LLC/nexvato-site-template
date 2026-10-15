'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULTS, buildSiteContent } from '@/lib/content';
import { IS_CONNECTED } from '@/lib/shop';
import { useShopConfig } from '@/components/ShopConfigProvider';

const ContentContext = createContext(DEFAULTS);

/**
 * Site-wide managed content (homepage + global chrome).
 *
 * Built synchronously from DEFAULTS plus the shop's published website copy, so
 * first paint, SSR and hydration all agree — there is no fetch-then-flash.
 */
export default function ContentProvider({ children }) {
  const { config } = useShopConfig();
  const content = useMemo(() => buildSiteContent(config, IS_CONNECTED), [config]);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(ContentContext) || DEFAULTS;
}
