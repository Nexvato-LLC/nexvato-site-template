import { fetchCatalog } from '@/lib/shop';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default async function sitemap() {
  let products = [];
  try { products = await fetchCatalog(); } catch (e) { products = []; }
  return [
    { url: BASE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/shop`, changeFrequency: 'daily', priority: 0.9 },
    ...products.map((p) => ({ url: `${BASE}/product/${p.id}`, changeFrequency: 'weekly', priority: 0.7 })),
  ];
}
