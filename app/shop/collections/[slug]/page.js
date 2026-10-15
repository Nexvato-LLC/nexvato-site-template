import { notFound, redirect } from 'next/navigation';
import ShopClient from '../../ShopClient';
import { IS_CONNECTED, fetchCollections, fetchCollectionPage, fetchShopConfig } from '@/lib/shop';
import { resolveBrand } from '@/lib/brand';

const one = (v) => (Array.isArray(v) ? v[0] : v);

/**
 * A collection's own storefront address: /shop/collections/<slug>.
 *
 * The dashboard tells merchants this is where an active collection lives, and
 * until now the storefront had no such route — it 404'd (support #225). An
 * unknown, draft or archived slug is a real 404; a collection that was renamed
 * redirects from its old address to the new one.
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [res, config] = await Promise.all([fetchCollectionPage(slug), fetchShopConfig()]);
  if (res.status === 'missing') return { title: 'Collection not found', robots: { index: false } };
  const brand = resolveBrand(config, IS_CONNECTED);
  if (res.status !== 'ok') return { title: 'Collection' };
  const c = res.collection;
  return {
    title: c.seoTitle || c.name,
    description: (c.seoDescription || c.description || `Shop ${c.name} at ${brand.name}.`).slice(0, 160),
    alternates: { canonical: `/shop/collections/${c.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = (await searchParams) || {};
  const [res, collections] = await Promise.all([fetchCollectionPage(slug), fetchCollections()]);

  if (res.status === 'missing') notFound();
  if (res.status === 'error') {
    // The API is down: say so and offer a retry, instead of a 404 that would be a lie.
    return (
      <div data-screen-label="Collection" style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 36, textTransform: 'uppercase', color: 'var(--ink)' }}>Collection unavailable</h1>
        <p style={{ margin: '12px 0 0', color: 'var(--text-muted)', lineHeight: 1.6 }}>We couldn&rsquo;t load this collection just now. Please refresh in a moment.</p>
      </div>
    );
  }
  if (res.collection.slug !== slug) redirect(`/shop/collections/${res.collection.slug}`);

  return (
    <ShopClient
      initialCat={one(sp.cat) ?? null}
      initialBrand={one(sp.brand) ?? null}
      initialQ={one(sp.q) ?? ''}
      collections={collections}
      activeCollection={res.collection}
      collectionProductIds={res.products.map((p) => p.productId)}
      basePath={`/shop/collections/${res.collection.slug}`}
    />
  );
}
