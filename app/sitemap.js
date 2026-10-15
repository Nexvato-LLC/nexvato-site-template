import { fetchCatalog, fetchCollections } from '@/lib/shop';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default async function sitemap() {
  let products = [];
  let collections = [];
  try { products = await fetchCatalog(); } catch (e) { products = []; }
  try { collections = await fetchCollections(); } catch (e) { collections = []; }
  return [
    { url: BASE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/shop`, changeFrequency: 'daily', priority: 0.9 },
    // Only active collections come back, so a draft or archived one never reaches a crawler.
    ...collections.map((c) => ({ url: `${BASE}/shop/collections/${c.slug}`, changeFrequency: 'weekly', priority: 0.8 })),
    ...products.map((p) => ({ url: `${BASE}/product/${p.id}`, changeFrequency: 'weekly', priority: 0.7 })),
  ];
}
