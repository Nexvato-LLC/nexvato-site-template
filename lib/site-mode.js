import { IS_CONNECTED } from '@/lib/shop';

/**
 * IS THIS A BROCHURE SITE OR A STORE?
 *
 * Every site ships with commerce code present but DORMANT. It switches on the
 * moment the platform connects a shop — nothing in this repo has to change.
 *
 * WHY IT WORKS THIS WAY. Adding ecommerce must never mean regenerating the
 * repo: by the time a client asks for a store, their site usually carries
 * bespoke design work they paid for, and regenerating would throw it away.
 * Carrying a few dormant routes is a very small price for making the upgrade
 * a one-click, zero-risk operation.
 *
 * The switch is the presence of NEXT_PUBLIC_SHOP_ID, which the platform
 * injects when a shop is provisioned. There is deliberately no second flag to
 * forget: a site with a shop id IS a store, and one without is a website.
 */
export const HAS_COMMERCE = IS_CONNECTED;

/**
 * What each mode shows:
 *
 *   BROCHURE (no shop)   hero, services, about, promos, newsletter, contact.
 *                        No cart, no prices, no checkout. /shop, /product,
 *                        /checkout and /account return 404 — a dead link to a
 *                        store that does not exist is worse than no link.
 *
 *   STORE (shop connected)  everything above PLUS the product grids, the cart,
 *                        and the full commerce routes.
 *
 * Sections that are neither (services, about, promos) are driven by whether
 * their CONTENT exists, not by commerce — a store can still sell services and
 * a brochure site can still run promotions.
 */

/** Routes that only exist once a shop is connected. */
const COMMERCE_PATHS = ['/shop', '/checkout', '/account', '/product'];

export function isCommerceUrl(url = '') {
  return COMMERCE_PATHS.some(
    (p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`),
  );
}

/**
 * Resolve a link that may point into the store.
 *
 * On a brochure site any commerce URL is rewritten to `fallback` rather than
 * left to 404. This matters most for content-driven CTAs: the hero button
 * defaults to "/shop", and a client who adds a store later should not have to
 * remember to change it back — nor should a brochure client ship a hero button
 * that goes nowhere.
 */
export function resolveUrl(url, fallback = '#contact') {
  if (!url) return url;
  if (HAS_COMMERCE || !isCommerceUrl(url)) return url;
  return fallback;
}
