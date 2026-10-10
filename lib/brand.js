/**
 * Brand identity — THE FIRST FILE TO EDIT on a new client site.
 *
 * Name, tagline and description appear in the page title, social previews,
 * structured data, header and footer. Changing them here changes them
 * everywhere; no component hardcodes the brand. On a store, the business
 * name and logo saved in the Nexvato dashboard take precedence (support #133).
 *
 * Logo and imagery live in /public/assets — those ship as neutral SVG
 * placeholders and are meant to be replaced.
 */
export const BRAND = {
  /** Shown in the browser tab, footer, and social cards. */
  name: 'Your Brand',

  /** Optional line after the name in the browser tab and social previews. */
  tagline: '',

  /**
   * ~150 characters. This is the text Google shows under your link.
   * Keep it factual: no shipping speed, prices or guarantees the business has
   * not promised (support #133). On a store, the published website's SEO
   * description from the dashboard is used instead when one is saved.
   */
  description: 'Browse our products and order online.',

  /** Short description for social cards, where space is tighter. */
  shortDescription: 'Browse our products and order online.',

  /** Footer copyright line suffix, after the year and name. */
  footerSuffix: 'All rights reserved.',
};
