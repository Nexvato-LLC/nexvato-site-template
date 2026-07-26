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
import { BRAND } from "@/lib/brand";
import SetupNotice from "@/components/SetupNotice";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    url: "/",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    images: ["/assets/graphic-hero.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.shortDescription,
  },
};

// Structured data so search engines understand who this business is. Built
// from BRAND, so it can never drift from what the pages actually say.
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: BRAND.name,
      url: SITE_URL,
      logo: `${SITE_URL}/assets/logo.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      url: SITE_URL,
      name: BRAND.name,
      publisher: { "@id": `${SITE_URL}/#org` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/shop?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }) {
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
        <ContentProvider>
          <CartProvider>
            <AuthProvider>
              <SetupNotice />
          <Header />
              <main>{children}</main>
              <Footer />
              <CartDrawer />
            </AuthProvider>
          </CartProvider>
        </ContentProvider>
        <RouteWipe />
      </body>
    </html>
  );
}
