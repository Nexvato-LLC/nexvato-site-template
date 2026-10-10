import { fetchProduct } from '@/lib/shop';
import ProductClient from './ProductClient';
import { getStorefront } from '@/lib/storefront-server';
import { jsonLd } from '@/lib/jsonld';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const [p, { content }] = await Promise.all([fetchProduct(id), getStorefront()]);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const description = (p.blurb || `${p.title} from ${p.brand || content.brand.name}.`).slice(0, 155);
  return {
    title: p.title,
    description,
    alternates: { canonical: `/product/${id}` },
    // Only a real product photo is offered to social previews.
    openGraph: { type: 'website', title: p.title, description, url: `/product/${id}`, ...(p.hasPhoto ? { images: [p.image] } : {}) },
  };
}

export default async function Page({ params }) {
  const { id } = await params;
  const [p, { shop }] = await Promise.all([fetchProduct(id), getStorefront()]);

  // Structured data from the product as saved (support #133): its own photos,
  // its real stock state and the store's currency. No ratings — the template
  // has no reviews of its own to report — and serialized with jsonLd() so
  // saved text cannot break out of the script tag.
  const jsonld = p && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.blurb || p.title,
    ...(p.hasPhoto ? { image: p.photos } : {}),
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: String(shop?.currency || 'usd').toUpperCase(),
      price: p.price,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/product/${id}`,
    },
  };

  return (
    <>
      {jsonld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonld) }} />}
      <ProductClient initial={p} />
    </>
  );
}
