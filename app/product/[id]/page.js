import { fetchProduct } from '@/lib/shop';
import ProductClient from './ProductClient';
import { BRAND } from "@/lib/brand";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
// No per-product photography exists (art is generative SVG), so social/JSON-LD
// share the brand hero image — a real hosted URL scrapers can actually fetch.
const SHARE_IMG = '/assets/graphic-hero.svg';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await fetchProduct(id);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const description = (p.blurb || `${p.title} from ${p.brand || BRAND.name}.`).slice(0, 155);
  return {
    title: p.title,
    description,
    alternates: { canonical: `/product/${id}` },
    openGraph: { type: 'website', title: p.title, description, url: `/product/${id}`, images: [SHARE_IMG] },
  };
}

export default async function Page({ params }) {
  const { id } = await params;
  const p = await fetchProduct(id);

  const jsonld = p && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.blurb || p.title,
    image: [`${SITE_URL}${SHARE_IMG}`],
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: p.price,
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/product/${id}`,
    },
    ...(p.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews || 1 } } : {}),
  };

  return (
    <>
      {jsonld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />}
      <ProductClient initial={p} />
    </>
  );
}
