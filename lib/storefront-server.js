import { cache } from 'react';
import { fetchShopConfig } from '@/lib/shop';
import { buildSiteContent } from '@/lib/content';

/**
 * The store's settings and the site content built from them, for SERVER
 * components (layouts, pages, generateMetadata). Read once per request —
 * React's cache() shares the answer between metadata and render — and never
 * cached across requests, so a saved change shows on the next page load.
 *
 * Reading uncached settings makes these pages render per request rather than
 * at build time. That is the point: the business name, logo, copy and
 * shipping rules live in the dashboard, not in this build.
 */
export const getStorefront = cache(async () => {
  const shop = await fetchShopConfig();
  return { shop, content: buildSiteContent(shop) };
});
