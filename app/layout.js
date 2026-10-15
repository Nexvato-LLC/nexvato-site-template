import Script from "next/script";
import "@/styles/ds/styles.css";
import "./globals.css";
import CartProvider from "@/components/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import RouteWipe from "@/components/RouteWipe";
import AuthProvider from "@/components/AuthProvider";
import ContentProvider from "@/components/ContentProvider";
import ShopConfigProvider from "@/components/ShopConfigProvider";
import WishlistProvider from "@/components/WishlistProvider";
import { resolveBrand } from "@/lib/brand";
import { IS_CONNECTED, fetchShopConfig } from "@/lib/shop";
import SetupNotice from "@/components/SetupNotice";
import { HAS_COMMERCE } from "@/lib/site-mode";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * The shop's real identity, read on the SERVER so the HTML title, social
 * previews and structured data carry the right name on first byte — not
 * "Your Brand" until JavaScript runs (support #220). Revalidated every minute.
 */
async function loadBrand() {
  const config = await fetchShopConfig();
  return { config, brand: resolveBrand(config, IS_CONNECTED) };
}

export async function generateMetadata() {
  const { brand } = await loadBrand();
  const full = brand.tagline ? `${brand.name} — ${brand.tagline}` : brand.name;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: full, template: `%s · ${brand.name}` },
    description: brand.description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: brand.name,
      url: "/",
      title: full,
      description: brand.shortDescription,
      images: [brand.logoUrl || "/assets/graphic-hero.svg"],
    },
    twitter: {
      card: "summary_large_image",
      title: brand.name,
      description: brand.shortDescription,
    },
  };
}

// Structured data so search engines understand who this business is. Built
// from the resolved brand, so it can never drift from what the pages say.
function orgJsonLd(brand) {
  const logo = brand.logoUrl || (brand.logoPath ? `${SITE_URL}${brand.logoPath}` : undefined);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: brand.name,
        url: SITE_URL,
        ...(logo ? { logo } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        url: SITE_URL,
        name: brand.name,
        publisher: { "@id": `${SITE_URL}/#org` },
        // Only advertise site search when there is a store to search. On a
        // brochure site /shop is a 404, and telling search engines otherwise
        // invites them to crawl a dead endpoint.
        ...(HAS_COMMERCE
          ? {
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/shop?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }
          : {}),
      },
    ],
  };
}

export default async function RootLayout({ children }) {
  const { config, brand } = await loadBrand();
  return (
    <html lang="en">
      <head>
        <Script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/Flip.min.js" strategy="beforeInteractive" />
        <Script src="/storefront/fx.js" strategy="beforeInteractive" />
        <Script src="/storefront/motion.js" strategy="beforeInteractive" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd(brand)) }} />
        <ShopConfigProvider initialConfig={config}>
          <ContentProvider>
            <CartProvider>
              <AuthProvider>
                <WishlistProvider>
                  <SetupNotice />
                  <Header />
                  <main>{children}</main>
                  <Footer />
                  {HAS_COMMERCE && <CartDrawer />}
                </WishlistProvider>
              </AuthProvider>
            </CartProvider>
          </ContentProvider>
        </ShopConfigProvider>
        <RouteWipe />
      </body>
    </html>
  );
}
