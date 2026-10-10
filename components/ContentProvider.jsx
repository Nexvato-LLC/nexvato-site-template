'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_CONTENT, buildSiteContent } from '@/lib/content';
import { useShopConfig } from '@/components/ShopConfigProvider';

const ContentContext = createContext(DEFAULT_CONTENT);

/**
 * Site-wide content (homepage + global chrome): the business identity and
 * published website copy from the store's settings, over the defaults in
 * lib/content.js. Derived from ShopConfigProvider, whose first value is read
 * on the server — so the HTML already carries the real name, logo and copy
 * (support #133) and the client renders exactly the same thing.
 */
export default function ContentProvider({ children }) {
  const { config } = useShopConfig();
  const content = useMemo(() => buildSiteContent(config), [config]);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(ContentContext) || DEFAULT_CONTENT;
}
