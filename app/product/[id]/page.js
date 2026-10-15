import { IS_CONNECTED, fetchProduct, fetchProductReviews, fetchShopConfig } from '@/lib/shop';
import { resolveBrand } from '@/lib/brand';
import ProductClient from './ProductClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
// Fallback share image for a product with no photo: a neutral hero graphic.
const SHARE_IMG = '/assets/graphic-hero.svg';

const absolute = (u) => (/^https?:\/\//i.test(u) ? u : `${SITE_URL}${u}`);

export async function generateMetadata({ params }) {
  const { id } = await params;
  const [p, config] = await Promise.all([fetchProduct(id), fetchShopConfig()]);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const brand = resolveBrand(config, IS_CONNECTED);
  const description = (p.blurb || `${p.title} from ${p.brand || brand.name}.`).slice(0, 155);
  const image = p.images?.[0] || SHARE_IMG;
  return {
    title: p.title,
    description,
    alternates: { canonical: `/product/${id}` },
    openGraph: { type: 'website', title: p.title, description, url: `/product/${id}`, images: [image] },
  };
}

export default async function Page({ params }) {
  const { id } = await params;
  const p = await fetchProduct(id);
  // Real reviews, fetched here so the structured data and the page agree on them.
  const reviews = p ? await fetchProductReviews(p.productId) : null;

  const jsonld = p && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.blurb || p.title,
    image: [absolute(p.images?.[0] || SHARE_IMG)],
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: p.price,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/product/${id}`,
    },
    // Only when verified reviews exist — an invented rating in structured data
    // is a policy violation, not just a cosmetic bug.
    ...(reviews && reviews.total > 0 && reviews.average
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.average, reviewCount: reviews.total } }
      : {}),
  };

  return (
    <>
      {jsonld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />}
      {/* key: remount per product so qty / option / tab state never leaks between products. */}
      <ProductClient key={p?.productId || id} initial={p} initialReviews={reviews} />
    </>
  );
}
