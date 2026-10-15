/**
 * Brand identity — THE FIRST FILE TO EDIT on a new client site.
 *
 * Name, tagline and description appear in the page title, social previews,
 * structured data, header and footer. Changing them here changes them
 * everywhere; no component hardcodes the brand.
 *
 * Logo and imagery live in /public/assets — those ship as neutral SVG
 * placeholders and are meant to be replaced.
 */
export const BRAND = {
  /** Shown in the browser tab, footer, and social cards. */
  name: 'Your Brand',

  /** One line under the name in search and social previews. */
  tagline: 'Quality Products, Fair Prices',

  /** ~150 characters. This is the text Google shows under your link. */
  description:
    'Carefully selected products, straightforward pricing, and fast shipping from people who know what they sell.',

  /** Short description for social cards, where space is tighter. */
  shortDescription: 'Quality products, fair prices, fast shipping.',

  /** Footer copyright line suffix, after the year and name. */
  footerSuffix: 'All rights reserved.',

  /**
   * Optional logo image, as a path under /public (e.g. '/assets/logo.svg').
   * Leave null to show a text wordmark. A store's own logo, uploaded in the
   * Nexvato dashboard, always wins over this.
   */
  logo: null,
};

// The template's stock copy. Compared against so a designer who HAS edited
// lib/brand.js for a client keeps their wording, while an untouched template
// never leaks its placeholder text onto a connected store.
const PLACEHOLDER_NAME = 'Your Brand';
const PLACEHOLDER_TAGLINE = 'Quality Products, Fair Prices';
const PLACEHOLDER_DESCRIPTION =
  'Carefully selected products, straightforward pricing, and fast shipping from people who know what they sell.';
const PLACEHOLDER_SHORT = 'Quality products, fair prices, fast shipping.';

/**
 * The brand to render, given the shop config from GET /{shopId}.
 *
 * WHY THIS EXISTS: BRAND above is generic by design, so a store that read it
 * directly showed "Your Brand" in its header, footer and browser tab
 * (support #220). A connected store is named by its shop — that is the name on
 * its order emails — and BRAND is the fallback for a site with no shop.
 *
 * `connected` with no config (the API was unreachable) must not fall back to
 * the placeholder either: a customised BRAND.name is fine, the stock one is not.
 */
export function resolveBrand(config, connected) {
  if (!connected) {
    return { ...BRAND, logoUrl: '', logoPath: BRAND.logo || '' };
  }
  const name = config?.name || (BRAND.name !== PLACEHOLDER_NAME ? BRAND.name : 'Store');
  const seo = typeof config?.seo?.description === 'string' ? config.seo.description.trim() : '';
  return {
    ...BRAND,
    name,
    tagline: BRAND.tagline !== PLACEHOLDER_TAGLINE ? BRAND.tagline : '',
    description: seo || (BRAND.description !== PLACEHOLDER_DESCRIPTION ? BRAND.description : `Shop ${name}.`),
    shortDescription: BRAND.shortDescription !== PLACEHOLDER_SHORT ? BRAND.shortDescription : `Shop ${name}.`,
    logoUrl: config?.logoUrl || '',
    logoPath: BRAND.logo || '',
  };
}
