/**
 * Site copy — EDIT THIS FILE FIRST when building out a new client site.
 *
 * Every headline, label and link on the homepage and chrome comes from here,
 * so a site can be rebranded without touching a component. Product data does
 * NOT live here — that comes from the client's catalog in the Nexvato
 * dashboard and changes without a deploy.
 *
 * The copy below is deliberately generic and vertical-neutral. It should read
 * as plausible for a plumbing supplier, a boutique, or a parts distributor.
 * Replace it; do not ship it as-is.
 */
export const DEFAULTS = {
  home: {
    hero_eyebrow: 'Quality goods, honestly priced',
    hero_headline: 'Everything you need, in one place',
    // The word in the headline that receives the accent treatment.
    hero_accent: 'need',
    hero_subcopy:
      'Carefully selected products, straightforward pricing, and fast shipping. Built for customers who would rather get it right the first time.',
    hero_cta_primary_label: 'Shop the Collection',
    hero_cta_primary_url: '/shop',
    hero_cta_secondary_label: 'About Us',
    hero_cta_secondary_url: '#about-band',
    hero_trust: ['Fast Shipping', 'Easy Returns', 'Real Support'],

    featured: {
      eyebrow: 'Customer favorites',
      title: 'Featured Products',
      subtitle: 'The products our regulars come back for.',
    },
    collectibles: {
      eyebrow: 'Worth a look',
      title: 'New Arrivals',
      subtitle: 'Recently added to the catalog.',
    },
    brands: {
      eyebrow: 'Shop by Brand',
      title: 'Brands We Carry',
      subtitle: 'Names our customers already trust.',
    },

    // Generic "about" band. Replace with the client's real story — this is
    // usually the highest-value section on the page for conversion.
    cause_eyebrow: 'A little about us',
    cause_title: 'Built on doing right by our customers',
    cause_body:
      'We started with a simple idea: sell good products, price them fairly, and stand behind everything that leaves the door. That has not changed.',
    cause_cta_label: 'Browse the collection',
    cause_cta_url: '/shop',
    cause_image_url: '/assets/graphic-cause.svg',
    cause_stats: [
      { value: '10k+', label: 'Orders shipped' },
      { value: '4.8', label: 'Average rating' },
      { value: '24h', label: 'Typical dispatch' },
    ],

    // ── Brochure sections ────────────────────────────────────────────────
    // These render on EVERY site, store or not. A shop does not stop a
    // business from having services to describe or a phone number to call.
    // Set `services.items` to an empty array to hide the section entirely.
    services: {
      eyebrow: 'What we do',
      title: 'How we can help',
      subtitle: 'Straightforward work, done properly, by people who answer the phone.',
      items: [
        {
          title: 'Consultation',
          body: 'Tell us what you need and we will tell you honestly whether we are the right fit.',
        },
        {
          title: 'Delivery',
          body: 'Work scheduled when we say it will be, and finished when we say it will be.',
        },
        {
          title: 'Support',
          body: 'A real person who knows your account, not a ticket number in a queue.',
        },
      ],
    },

    contact: {
      eyebrow: 'Get in touch',
      title: 'Talk to us',
      subtitle: 'Questions, quotes, or just checking whether we cover your area.',
      phone: '',        // e.g. '(555) 123-4567' — hidden when blank
      email: '',        // e.g. 'hello@yourbrand.com' — hidden when blank
      address: '',      // hidden when blank
      hours: 'Mon–Fri, 9am–5pm',
      cta_label: 'Send a message',
      cta_url: '#',
    },

    newsletter_eyebrow: 'Stay in the loop',
    newsletter_title: 'New products and offers',
    newsletter_subcopy: 'Occasional email. No spam, and one click to leave.',
    newsletter_button_label: 'Sign up',

    announcement_left: 'Free shipping on qualifying orders',
    announcement_right: 'Easy 30-day returns',

    footer: {
      blurb:
        'Quality products, fair pricing, and support from people who actually know what they sell.',
      columns: [
        {
          title: 'Shop',
          links: [
            { label: 'New Arrivals', url: '/shop' },
            { label: 'Best Sellers', url: '/shop' },
            { label: 'Sale', url: '/shop' },
          ],
        },
        {
          title: 'Help',
          links: [
            { label: 'Track Order', url: '/orders/lookup' },
            { label: 'Shipping', url: '#' },
            { label: 'Returns', url: '#' },
            { label: 'Contact', url: '#' },
          ],
        },
        {
          title: 'Company',
          links: [{ label: 'About', url: '/#about-band' }],
        },
      ],
      legal: [
        { label: 'Privacy', url: '#' },
        { label: 'Terms', url: '#' },
        { label: 'Accessibility', url: '#' },
      ],
    },
  },

  promos: [
    {
      eyebrow: 'Limited time',
      title: 'Seasonal Savings',
      image_url: '/assets/graphic-promo-a.svg',
      overlay: 'navy',
      align: 'left',
      link_url: '/shop',
    },
    {
      eyebrow: 'Just landed',
      title: 'New Arrivals',
      image_url: '/assets/graphic-promo-b.svg',
      overlay: 'navy',
      align: 'right',
      link_url: '/shop',
    },
  ],
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Build the { home, promos } the site renders.
 *
 * Starts from DEFAULTS and, for a connected store, lays the merchant's
 * published website copy (hero, about, contact — the blocks the Nexvato site
 * editor writes into the shop's storefront content) on top. Anything the
 * merchant has not written falls back to DEFAULTS, so the page can never
 * render blank.
 *
 * `connected` also drops the placeholder "10k+ orders / 4.8 average rating /
 * 24h dispatch" stats: they are invented numbers, and printing a made-up
 * rating on a real store is worse than printing nothing (support #213).
 */
export function buildSiteContent(config, connected) {
  const home = { ...DEFAULTS.home };
  if (connected) home.cause_stats = [];
  const site = config?.siteContent;
  if (site) {
    const hero = site.hero || {};
    if (str(hero.headline)) { home.hero_headline = str(hero.headline); home.hero_accent = ''; }
    if (str(hero.subhead)) home.hero_subcopy = str(hero.subhead);
    const about = site.about || {};
    if (str(about.title)) home.cause_title = str(about.title);
    if (str(about.body)) home.cause_body = str(about.body);
    const contact = site.contact || {};
    const hours = Array.isArray(contact.hours) ? contact.hours.map(str).filter(Boolean).join(' · ') : str(contact.hours);
    home.contact = {
      ...DEFAULTS.home.contact,
      ...(str(contact.phone) ? { phone: str(contact.phone) } : {}),
      ...(str(contact.email) ? { email: str(contact.email) } : {}),
      ...(str(contact.address) ? { address: str(contact.address) } : {}),
      ...(hours ? { hours } : {}),
    };
  }
  return { home, promos: DEFAULTS.promos };
}
