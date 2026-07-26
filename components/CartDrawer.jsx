'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PriceTag from '@/components/ds/PriceTag';
import Button from '@/components/ds/Button';
import { useCart } from '@/components/CartProvider';

/** Flag-colored confetti burst — one-shot, cleans itself up. gsap-gated. */
function fireConfetti(host) {
  const g = window.gsap;
  if (!host || !g) return;
  const colors = ['#c1272d', '#2e3192', '#e0b45e', '#ffffff'];
  for (let i = 0; i < 16; i++) {
    const d = document.createElement('span');
    d.style.cssText =
      `position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:1px;pointer-events:none;z-index:5;background:${colors[i % 4]};`;
    host.appendChild(d);
    g.fromTo(
      d,
      { x: 0, y: 0, opacity: 1, rotate: 0 },
      {
        x: (Math.random() - 0.5) * 240, y: 40 + Math.random() * 80, rotate: Math.random() * 360,
        opacity: 0, duration: 0.9 + Math.random() * 0.5, ease: 'power2.out', delay: i * 0.012,
        onComplete: () => d.remove(),
      }
    );
  }
}

export default function CartDrawer() {
  const router = useRouter();
  const { cartOpen, closeCart, items, cartCount, subtotal, shipMsg, shipPct, remaining, setQty, remove } = useCart();
  const shipHostRef = useRef(null);
  const closeBtnRef = useRef(null);
  const prevRemaining = useRef(remaining);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scrim = document.getElementById('site-cart-scrim');
    const panel = document.getElementById('site-cart-panel');
    window.SiteMotion?.cart(cartOpen, { scrim, panel });
  }, [cartOpen]);

  // Modal a11y: focus the close button on open (after the slide-in) and close on Escape.
  useEffect(() => {
    if (!cartOpen) return undefined;
    const t = setTimeout(() => closeBtnRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') closeCart(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, [cartOpen, closeCart]);

  const unlocked = remaining === 0 && items.length > 0;
  useEffect(() => {
    if (prevRemaining.current > 0 && remaining === 0 && items.length > 0) {
      const reduced =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.__JAYS_FORCE_REDUCED === true;
      if (!reduced) fireConfetti(shipHostRef.current);
    }
    prevRemaining.current = remaining;
  }, [remaining, items.length]);

  const goCheckout = () => { closeCart(); router.push('/checkout'); };
  const goShop = () => { closeCart(); router.push('/shop'); };

  return (
    <>
      <div id="site-cart-scrim" onClick={closeCart} style={{ position: 'fixed', inset: 0, background: 'rgba(16,35,61,0.55)', opacity: 0, pointerEvents: 'none', zIndex: 60 }} />
      <aside id="site-cart-panel" role="dialog" aria-modal="true" aria-label="Shopping cart" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw', background: 'var(--white)', boxShadow: 'var(--shadow-lg)', transform: 'translateX(103%)', zIndex: 61, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, textTransform: 'uppercase', color: 'var(--ink)' }}>Your Cart ({cartCount})</span>
          <button ref={closeBtnRef} onClick={closeCart} aria-label="Close cart" className="site-removebtn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-strong)', padding: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div ref={shipHostRef} style={{ position: 'relative', padding: '16px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: unlocked ? 'var(--gold-600)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color var(--dur-normal)' }}>
              {unlocked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
              {shipMsg}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.36s ease-out, background 0.36s', width: `${shipPct}%`, background: unlocked ? 'var(--gold-500)' : 'var(--brand-royal)' }} />
          </div>
        </div>

        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '8px 22px' }}>
          {items.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '54px 12px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gray-100)', display: 'grid', placeItems: 'center', color: 'var(--gray-400)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, textTransform: 'uppercase', color: 'var(--ink)' }}>Your cart is empty</div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', maxWidth: 240, lineHeight: 1.6 }}>Add some all-American gear and it&rsquo;ll show up right here.</p>
              <Button variant="primary" arrow onClick={goShop}>Shop the Collection</Button>
            </div>
          )}
          {items.map((it) => (
            <div key={it.id} data-cart-item style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div role="img" aria-label={it.title} style={{ width: 68, height: 68, borderRadius: 4, flexShrink: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${it.image || ''}")` }} />
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{it.brand}</div>
                <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3, color: 'var(--text-strong)', margin: '2px 0 6px' }}>{it.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 2 }}>
                    <button onClick={() => setQty(it.id, -1)} aria-label="Decrease quantity" className="site-qtybtn" style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
                    </button>
                    <span style={{ width: 40, textAlign: 'center', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{it.qty}</span>
                    <button onClick={() => setQty(it.id, 1)} aria-label="Increase quantity" className="site-qtybtn" style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                  <PriceTag price={it.lineTotal} size="sm" />
                </div>
              </div>
              <button onClick={() => remove(it.id)} aria-label="Remove item" className="site-removebtn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', alignSelf: 'flex-start', padding: 2 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div data-cart-foot style={{ padding: '18px 22px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-strong)' }}>Subtotal</span>
              <PriceTag price={subtotal} size="lg" />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Shipping &amp; taxes calculated at checkout.</p>
            <Button variant="primary" size="lg" fullWidth arrow onClick={goCheckout}>Checkout</Button>
            <Button variant="outline" fullWidth onClick={closeCart}>Continue Shopping</Button>
          </div>
        )}
      </aside>
    </>
  );
}
