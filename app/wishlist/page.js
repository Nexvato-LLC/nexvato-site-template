'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/components/CartProvider';
import { useWishlist } from '@/components/WishlistProvider';
import { useAuth } from '@/components/AuthProvider';
import useStorefrontMotion from '@/lib/useStorefrontMotion';
import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';
import ProductCard from '@/components/ds/ProductCard';

/**
 * The shopper's saved products. Signed-in lists come from the shop's wishlist
 * API (and follow the account between devices); a guest's list lives in this
 * browser. Either way the products are looked up in the catalog the cart
 * provider already loaded, so a product that was unpublished since it was saved
 * simply isn't shown — it stays saved, and returns if it is republished.
 */
export default function WishlistPage() {
  useStorefrontMotion();
  const router = useRouter();
  const { catalog, catalogLoading, add } = useCart();
  const { ids, has, toggle, ready } = useWishlist();
  const { customer } = useAuth();

  const products = catalog.filter((p) => ids.includes(p.productId));
  const loading = catalogLoading || !ready;

  return (
    <div data-screen-label="Wishlist" style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div data-rise style={{ marginBottom: 28 }}>
        <Eyebrow color="royal" rule>Saved for later</Eyebrow>
        <h1 style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,4.4vw,52px)', textTransform: 'uppercase', color: 'var(--ink)' }}>Your Wishlist</h1>
        {!customer && !loading && products.length > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
            Saved on this device. <a href="/account" onClick={(e) => { e.preventDefault(); router.push('/account'); }} style={{ color: 'var(--link)' }}>Sign in</a> to keep your list on every device.
          </p>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="site-skel" style={{ aspectRatio: '1 / 1.4' }} />)}
        </div>
      ) : products.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 16, color: 'var(--text-muted)' }}>You haven&rsquo;t saved anything yet. Tap the heart on a product to keep it here.</p>
          <Button variant="primary" arrow onClick={() => router.push('/shop')}>Browse the shop</Button>
        </div>
      ) : (
        <div data-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 20 }}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              brand={p.brand}
              title={p.title}
              image={p.image}
              price={p.price}
              compareAt={p.compareAt}
              badge={p.badge}
              badgeVariant={p.badgeVariant}
              wishlisted={has(p.productId)}
              onWishlist={() => toggle(p.productId)}
              onClick={() => router.push('/product/' + p.id)}
              onQuickAdd={() => add(p.id, 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
