import { notFound, redirect } from 'next/navigation';
import ShopClient from './ShopClient';
import { IS_CONNECTED, fetchCollections, fetchCollectionPage, fetchShopConfig } from '@/lib/shop';
import { resolveBrand } from '@/lib/brand';

const one = (v) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }) {
  const sp = (await searchParams) || {};
  const cat = one(sp.cat);
  const brandFilter = one(sp.brand);
  const q = one(sp.q);
  const collectionSlug = one(sp.collection);
  const brand = resolveBrand(await fetchShopConfig(), IS_CONNECTED);

  let collectionName = null;
  if (collectionSlug) {
    const res = await fetchCollectionPage(collectionSlug);
    if (res.status === 'ok') collectionName = res.collection.name;
  }
  const label = collectionName || cat || brandFilter;
  const title = q ? `Search: ${q}` : label ? `${label}` : 'Shop All';
  const description = label
    ? `Shop ${label} at ${brand.name}.`
    : `Shop the full ${brand.name} collection.`;
  const canonical = collectionSlug
    ? `/shop/collections/${collectionSlug}`
    : cat
      ? `/shop?cat=${encodeURIComponent(cat)}`
      : brandFilter
        ? `/shop?brand=${encodeURIComponent(brandFilter)}`
        : '/shop';
  return { title, description, alternates: { canonical } };
}

// Server component: reads the URL query so the collection grid is server-rendered
// (SSR + shareable URLs), then hands the seeds to the interactive client child.
export default async function ShopPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const collectionSlug = one(sp.collection);

  const collections = await fetchCollections();

  // /shop?collection=<slug> filters to that collection (support #225). It used
  // to ignore the parameter and list everything.
  let activeCollection = null;
  let collectionProductIds = null;
  if (collectionSlug) {
    const res = await fetchCollectionPage(collectionSlug);
    if (res.status === 'missing') notFound();
    if (res.status === 'ok') {
      // A renamed collection's old address resolves to the new one: follow it.
      if (res.collection.slug !== collectionSlug) {
        const rest = new URLSearchParams();
        for (const [k, v] of Object.entries(sp)) if (k !== 'collection' && one(v)) rest.set(k, one(v));
        redirect(`/shop/collections/${res.collection.slug}${rest.size ? `?${rest}` : ''}`);
      }
      activeCollection = res.collection;
      collectionProductIds = res.products.map((p) => p.productId);
    }
    // status 'error': the API is unreachable — show the full shop rather than a false 404.
  }

  return (
    <ShopClient
      initialCat={one(sp.cat) ?? null}
      initialBrand={one(sp.brand) ?? null}
      initialQ={one(sp.q) ?? ''}
      collections={collections}
      activeCollection={activeCollection}
      collectionProductIds={collectionProductIds}
    />
  );
}
