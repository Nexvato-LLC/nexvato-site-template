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
 * Generated placeholder artwork for a product with no image.
 *
 * Deliberately an abstract motif rather than a fake photograph — it should be
 * obvious at a glance that a real image is still missing, without the page
 * looking broken. Colours follow the site's own palette.
 */
export function productArt(p) {
  const tone = p.tone || '#334155';
  const cat = (p.cat || '').toUpperCase();
  const brand = (p.brand || '').toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='500' viewBox='0 0 600 500'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${tone}'/>
        <stop offset='1' stop-color='#0f172a'/>
      </linearGradient>
    </defs>
    <rect width='600' height='500' fill='url(#g)'/>
    <g opacity='0.08' fill='#f5f5f4'>
      ${[0, 1, 2, 3, 4, 5, 6, 7]
        .map(
          (i) =>
            `<rect x='${-120 + i * 90}' y='-40' width='34' height='620' transform='rotate(20 300 250)'/>`,
        )
        .join('')}
    </g>
    <circle cx='300' cy='215' r='58' fill='none' stroke='#4f46e5' stroke-width='3' opacity='0.85'/>
    <circle cx='300' cy='215' r='22' fill='#4f46e5' opacity='0.65'/>
    <text x='300' y='405' text-anchor='middle' font-family='Oswald, sans-serif' font-weight='700' font-size='30' letter-spacing='6' fill='#e7e5e4'>${brand}</text>
    <text x='300' y='440' text-anchor='middle' font-family='Oswald, sans-serif' font-weight='500' font-size='18' letter-spacing='4' fill='#a8a29e'>${cat}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
