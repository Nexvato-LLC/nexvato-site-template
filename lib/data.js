/**
 * Storefront facets + placeholder product art.
 *
 * ⚠️ PRODUCTS DO NOT LIVE HERE. The catalog comes from the client's Nexvato
 * dashboard via lib/shop.js and changes without a deploy. This file only
 * holds the filter lists shown on the shop page, and the generated artwork
 * used for products that have no photo yet.
 */

/**
 * Filter rails on /shop. Edit these to match the client's actual catalog —
 * they are not derived automatically, so a category listed here that has no
 * products will simply show a count of zero.
 */
export const CATALOG_FACETS = {
  brands: [],
  categories: [],
};

/**
 * Backwards-compatible alias. Older components import JAYS_DATA; keeping this
 * export means a site generated from an earlier template still builds.
 */
export const JAYS_DATA = CATALOG_FACETS;

/**
 * Placeholder for a product with no photo yet (support #133).
 *
 * Deliberately labelled "Photo coming soon" rather than abstract art that could
 * pass for a product shot — a shopper should never mistake it for what they are
 * buying. Colours follow the site's own palette via `tone`.
 */
export function productArt(p = {}) {
  const tone = p.tone || '#334155';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='500' viewBox='0 0 600 500'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${tone}'/>
        <stop offset='1' stop-color='#0f172a'/>
      </linearGradient>
    </defs>
    <rect width='600' height='500' fill='url(#g)'/>
    <g fill='none' stroke='#e7e5e4' stroke-width='6' stroke-linejoin='round' opacity='0.55'>
      <rect x='240' y='160' width='120' height='92' rx='10'/>
      <circle cx='300' cy='206' r='26'/>
    </g>
    <text x='300' y='320' text-anchor='middle' font-family='system-ui, sans-serif' font-weight='600' font-size='26' letter-spacing='3' fill='#e7e5e4'>PHOTO COMING SOON</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
