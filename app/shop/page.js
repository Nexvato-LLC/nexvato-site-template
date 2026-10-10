import ShopClient from './ShopClient';
import { getStorefront } from '@/lib/storefront-server';

const one = (v) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }) {
  const sp = (await searchParams) || {};
  const { content } = await getStorefront();
  const name = content.brand.name;
  const cat = one(sp.cat);
  const brand = one(sp.brand);
  const q = one(sp.q);
  const label = cat || brand;
  const title = q ? `Search: ${q}` : label ? label : 'Shop';
  const description = label
    ? `Shop ${label} at ${name}.`
    : `Shop the full ${name} collection.`;
  const canonical = cat
    ? `/shop?cat=${encodeURIComponent(cat)}`
    : brand
      ? `/shop?brand=${encodeURIComponent(brand)}`
      : '/shop';
  return { title, description, alternates: { canonical } };
}

// Server component: reads the URL query so the collection grid is server-rendered
// (SSR + shareable URLs), then hands the seeds to the interactive client child.
export default async function ShopPage({ searchParams }) {
  const sp = (await searchParams) || {};
  return (
    <ShopClient
      initialCat={one(sp.cat) ?? null}
      initialBrand={one(sp.brand) ?? null}
      initialQ={one(sp.q) ?? ''}
    />
  );
}
