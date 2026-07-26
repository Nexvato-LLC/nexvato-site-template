'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Input from '@/components/ds/Input';
import IconButton from '@/components/ds/IconButton';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useSiteContent } from '@/components/ContentProvider';
import { BRAND } from "@/lib/brand";

/* Ported from the source utility bar + <header id="site-header"> (SOURCE
   lines ~35-66) and the navItems built in renderVals() (lines ~699-712). */

const navStyleBase = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  paddingBottom: 4,
};

function NavLink({ href, active, children }) {
  const [hover, setHover] = useState(false);
  const on = active || hover;
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-cursor="nav"
      style={{
        ...navStyleBase,
        position: 'relative',
        display: 'inline-block',
        color: active ? 'var(--brand-royal)' : hover ? 'var(--ink)' : 'var(--text-strong)',
        transition: 'color var(--dur-fast) var(--ease-standard)',
      }}
    >
      {children}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: 'var(--brand-royal)',
          transform: on ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: on ? 'left center' : 'right center',
          transition: 'transform var(--dur-normal) var(--ease-out)',
        }}
      />
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount, openCart } = useCart();
  const { customer } = useAuth();
  const { home } = useSiteContent();
  const [q, setQ] = useState('');

  const headerRef = useRef(null);
  const barRef = useRef(null);
  const logoRef = useRef(null);

  // ponytail: active state from pathname only. Distinguishing Shop vs
  // Collectibles needs the ?cat= query, but useSearchParams() forces the whole
  // header to client-only render (no SSR nav). A query-only nav (/shop ->
  // /shop?cat=Collectibles) keeps the same pathname, so no cheap reactive read
  // exists without it. Dropping the Collectibles-specific underline is the
  // lazy-correct trade for a server-rendered header. Restore via useSearchParams
  // + a Suspense boundary if the precise highlight ever matters.
  const homeActive = pathname === '/';
  const shopActive = pathname === '/shop';
  const collectiblesActive = false;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let tries = 0;
    let pollId = null;
    let cleanup = null;

    const tryMount = () => {
      if (window.SiteMotion && headerRef.current && barRef.current && logoRef.current) {
        cleanup = window.SiteMotion.header(headerRef.current, barRef.current, logoRef.current);
        return true;
      }
      return false;
    };

    if (!tryMount()) {
      pollId = setInterval(() => {
        tries++;
        if (tryMount() || tries > 40) {
          clearInterval(pollId);
          pollId = null;
        }
      }, 120);
    }

    return () => {
      if (pollId) clearInterval(pollId);
      if (cleanup) cleanup();
    };
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    router.push('/shop?q=' + encodeURIComponent(q));
  };

  return (
    <>
      {/* Utility bar */}
      <div style={{ background: 'var(--navy-800)', color: 'var(--text-on-dark-muted)' }}>
        <div
          style={{
            maxWidth: 'var(--container)',
            margin: '0 auto',
            padding: '7px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            fontFamily: 'var(--font-heading)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--gold-400)', display: 'inline-flex' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="14" r="6"></circle>
                <path d="m9 3 3 6 3-6"></path>
              </svg>
            </span>
            {home.announcement_left}
          </span>
          <span>{home.announcement_right}</span>
        </div>
      </div>

      {/* Sticky header */}
      <header
        id="site-header"
        ref={headerRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--white)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          id="site-headbar"
          ref={barRef}
          style={{
            maxWidth: 'var(--container)',
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px 26px',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img
              id="site-logo"
              ref={logoRef}
              src="/assets/logo-transparent.svg"
              alt={BRAND.name}
              style={{ height: 60, width: 'auto', transformOrigin: 'left center', display: 'block' }}
            />
          </Link>

          <nav style={{ display: 'flex', gap: '12px 24px', flex: '1 1 auto', flexWrap: 'wrap', minWidth: 0 }}>
            <NavLink href="/" active={homeActive}>Home</NavLink>
            <NavLink href="/shop" active={shopActive}>Shop</NavLink>
            <NavLink href="/shop?cat=Collectibles" active={collectiblesActive}>Collectibles</NavLink>
            <NavLink href="/#cause-band" active={false}>Our Cause</NavLink>
          </nav>

          <form
            onSubmit={submitSearch}
            style={{ flex: '1 1 170px', maxWidth: 240, minWidth: 150 }}
          >
            <Input
              placeholder="Search products…"
              size="sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {customer ? (
              <button
                type="button"
                aria-label={`Account — signed in as ${customer.email}`}
                title={customer.email}
                onClick={() => router.push('/account')}
                style={{ width: 42, height: 42, borderRadius: '50%', cursor: 'pointer', border: '1px solid var(--gold-600)', background: 'var(--gold-400)', color: 'var(--navy-900)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, display: 'grid', placeItems: 'center' }}
              >
                {(customer.first_name || customer.email || '?').charAt(0).toUpperCase()}
              </button>
            ) : (
              <IconButton aria-label="Account" variant="ghost" onClick={() => router.push('/account')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"></circle>
                  <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"></path>
                </svg>
              </IconButton>
            )}
            <IconButton aria-label="Wishlist" variant="ghost">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20s-7-4.4-9.2-9C1.3 8 2.8 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.2 0 4.7 3 3.2 6-2.2 4.6-9.2 9-9.2 9Z"></path>
              </svg>
            </IconButton>
            <IconButton
              aria-label="Cart"
              variant="ghost"
              badge={cartCount || undefined}
              onClick={openCart}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6h15l-1.6 9.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.7L6 6Z"></path>
                <circle cx="9.5" cy="20" r="1.5"></circle>
                <circle cx="17.5" cy="20" r="1.5"></circle>
                <path d="M6 6 5.2 3H2.5"></path>
              </svg>
            </IconButton>
          </div>
        </div>
      </header>
    </>
  );
}
