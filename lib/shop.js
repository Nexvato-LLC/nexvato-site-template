// Nexvato commerce client.
//
// This file is the contract between a client site and the Nexvato platform.
// Everything it needs arrives as build-time environment variables that the
// platform injects when it provisions this repo — you should never have to
// edit them by hand, and there is nothing secret here.
//
// ⚠️ ONLY `NEXT_PUBLIC_*` VALUES ARE EVER INJECTED. They are compiled into the
// browser bundle and are readable by anyone who visits the site. The platform
// will never inject a secret key here, and neither should you: put nothing in
// this file you would not print on a billboard.

export const SHOP_API =
  process.env.NEXT_PUBLIC_SHOP_API_URL || "https://api.nexvato.com/api/v1/public/shop";

/** Which store this site sells. Injected at provision time. */
export const SHOP_ID = process.env.NEXT_PUBLIC_SHOP_ID || "";

/** Public site URL — drives canonical tags and the sitemap. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Money is integer cents everywhere on the wire. Convert in ONE place. */
export function formatPrice(cents, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents ?? 0) / 100);
}

async function api(path, init) {
  if (!SHOP_ID) {
    // Fail loudly rather than rendering an empty store. A missing shop id
    // used to produce a site that built green and sold nothing.
    throw new Error(
      "NEXT_PUBLIC_SHOP_ID is not set — this site is not connected to a store.",
    );
  }
  const res = await fetch(`${SHOP_API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    // Catalog is cached briefly: fast pages, edits visible within a minute.
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Shop API ${res.status} on ${path}`);
  return res.json();
}

export async function getProducts() {
  const { products } = await api(`/${SHOP_ID}/products`);
  return products ?? [];
}

export async function getProduct(slug) {
  const { product } = await api(`/${SHOP_ID}/products/${encodeURIComponent(slug)}`);
  return product ?? null;
}
