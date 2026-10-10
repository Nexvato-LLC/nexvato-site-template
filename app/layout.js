import Script from "next/script";
import "@/styles/ds/styles.css";
import "./globals.css";
import ShopConfigProvider from "@/components/ShopConfigProvider";
import CartProvider from "@/components/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import RouteWipe from "@/components/RouteWipe";
import AuthProvider from "@/components/AuthProvider";
import ContentProvider from "@/components/ContentProvider";
import SetupNotice from "@/components/SetupNotice";
import { HAS_COMMERCE } from "@/lib/site-mode";
import { getStorefront } from "@/lib/storefront-server";
import { jsonLd } from "@/lib/jsonld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Titles, descriptions and social cards come from the business identity and
// published SEO saved in the dashboard (support #133), read on the server for
// this request; lib/brand.js is the fallback when nothing is saved.
export async function generateMetadata() {
  const { content } = await getStorefront();
  const { brand, seo } = content;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: seo.title, template: `%s · ${brand.name}` },
    description: seo.description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: brand.name,
      url: "/",
      title: seo.title,
      description: seo.description,
      ...(brand.logoUrl ? { images: [brand.logoUrl] } : {}),
    },
    twitter: { card: "summary", title: brand.name, description: seo.description },
  };
}

// Structured data so search engines understand who this business is. Built
// only from what the business saved — no generic logo, no invented contact
// details — and serialized with jsonLd() so saved text cannot break out of
// the <script> tag.
function organizationJsonLd({ brand, home }) {
  const contact = home.contact || {};
  const contactPoint = contact.phone || contact.email
    ? {
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          ...(contact.phone ? { telephone: contact.phone } : {}),
          ...(contact.email ? { email: contact.email } : {}),
        },
      }
    : {};
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: brand.name,
        url: SITE_URL,
        ...(brand.logoUrl ? { logo: brand.logoUrl } : {}),
        ...contactPoint,
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
  const { shop, content } = await getStorefront();
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd(content)) }} />
        <ShopConfigProvider initial={shop}>
          <ContentProvider>
            <CartProvider>
              <AuthProvider>
                <SetupNotice />
                <Header />
                <main>{children}</main>
                <Footer />
                {HAS_COMMERCE && <CartDrawer />}
              </AuthProvider>
            </CartProvider>
          </ContentProvider>
        </ShopConfigProvider>
        <RouteWipe />
      </body>
    </html>
  );
}
