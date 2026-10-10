import { BRAND } from '@/lib/brand';

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
 *
 * NO CLAIMS IN DEFAULTS (support #133). A default must never promise what
 * the business has not said: no ratings or order counts, returns window,
 * warranty, dispatch time, opening hours, country of origin or "sale". Those
 * were here once and shipped on a live store. Leave such fields blank; blank
 * content hides its section instead of inventing it.
 *
 * On a store, the identity and published website copy saved in the Nexvato
 * dashboard (the Shop API's `storefront` object) take precedence over this
 * file; see buildSiteContent() below.
 */
export const DEFAULTS = {
  home: {
    hero_eyebrow: '',
    hero_headline: 'Everything you need, in one place',
    // The word in the headline that receives the accent treatment.
    hero_accent: 'need',
    hero_subcopy: '',
    hero_cta_primary_label: 'Shop the Collection',
    hero_cta_primary_url: '/shop',
    hero_cta_secondary_label: 'About Us',
    hero_cta_secondary_url: '#about-band',
    hero_trust: [],

    featured: {
      eyebrow: 'Shop',
      title: 'Featured Products',
      subtitle: '',
    },
    collectibles: {
      eyebrow: 'Worth a look',
      title: 'New Arrivals',
      subtitle: 'Recently added to the catalog.',
    },
    brands: {
      eyebrow: 'Shop by Brand',
      title: 'Brands We Carry',
      subtitle: '',
    },

    // "About" band. Hidden while both title and body are blank — replace with
    // the client's real story; it is usually the highest-value section on the
    // page for conversion.
    cause_eyebrow: 'About us',
    cause_title: '',
    cause_body: '',
    cause_cta_label: 'Browse the collection',
    cause_cta_url: '/shop',
    cause_image_url: '/assets/graphic-cause.svg',
    // Only real, sourced figures belong here ({ value, label }).
    cause_stats: [],

    // ── Brochure sections ────────────────────────────────────────────────
    // These render on EVERY site, store or not. A shop does not stop a
    // business from having services to describe or a phone number to call.
    // An empty `services.items` hides the section entirely.
    services: {
      eyebrow: 'What we do',
      title: 'How we can help',
      subtitle: '',
      items: [],
    },

    contact: {
      eyebrow: 'Get in touch',
      title: 'Talk to us',
      subtitle: '',
      phone: '',        // e.g. '(555) 123-4567' — hidden when blank
      email: '',        // e.g. 'hello@yourbrand.com' — hidden when blank
      address: '',      // hidden when blank
      hours: [],        // display lines, e.g. ['Mon–Fri · 9am–5pm'] — hidden when empty
      cta_label: '',
      cta_url: '',
    },

    announcement_left: '',
    announcement_right: '',

    footer: {
      blurb: '',
      columns: [
        {
          title: 'Shop',
          links: [{ label: 'Shop all', url: '/shop' }],
        },
        {
          title: 'Help',
          links: [{ label: 'Your account', url: '/account' }],
        },
      ],
      // Only real pages belong here — a "#" link is a dead end.
      legal: [],
    },
  },

  // Promo tiles. Empty by default: a "sale" or "limited time" tile is a claim.
  promos: [],
};

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const list = (v) => (Array.isArray(v) ? v : []);
/** Only plain web addresses (or site-relative paths) are rendered as images. */
const safeUrl = (v) => {
  const u = text(v);
  return /^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')) ? u : '';
};

/**
 * Everything the chrome and homepage render, for one store (support #133).
 *
 * `shop` is the Shop API config (GET /:shopId), read on the SERVER for the
 * first render — so titles, header, footer, homepage and structured data
 * carry the business's saved identity in the HTML, not after a client fetch.
 * Its `storefront` object holds only published, public data: `brand`
 * { name, logoUrl } and the published website's `content` and `seo`.
 *
 * Saved values win over the file defaults above, and anything that would
 * be a claim stays blank when nothing was saved. With no shop (a brochure
 * site, or a failed read) the file defaults are used as they are.
 */
export function buildSiteContent(shop) {
  const sf = obj(shop?.storefront);
  const c = obj(sf.content);
  const seo = obj(sf.seo);
  const hero = obj(c.hero);
  const about = obj(c.about);
  const contact = obj(c.contact);
  const d = DEFAULTS.home;
  const saved = Boolean(shop?.storefront);

  const name = text(obj(sf.brand).name) || BRAND.name;
  const logoUrl = safeUrl(obj(sf.brand).logoUrl) || null;
  const headline = text(hero.headline);
  const services = list(c.services)
    .map((x) => ({ title: text(x?.name), body: text(x?.description) }))
    .filter((x) => x.title);
  const hours = list(contact.hours).map(text).filter(Boolean);
  const email = text(contact.email);

  const home = {
    ...d,
    // A saved store with no headline shows its name, never the sample line.
    hero_headline: headline || (saved ? name : d.hero_headline),
    hero_accent: headline || saved ? '' : d.hero_accent,
    hero_subcopy: text(hero.subhead) || d.hero_subcopy,
    cause_title: text(about.title) || d.cause_title,
    cause_body: text(about.body) || d.cause_body,
    services: { ...d.services, items: services.length ? services : d.services.items },
    contact: {
      ...d.contact,
      phone: text(contact.phone) || d.contact.phone,
      email: email || d.contact.email,
      address: text(contact.address) || d.contact.address,
      hours: hours.length ? hours : d.contact.hours,
      ...(email ? { cta_label: 'Email us', cta_url: `mailto:${email}` } : {}),
    },
    announcement_left: text(c.announcement) || d.announcement_left,
  };
  const hasAbout = Boolean(home.cause_title || home.cause_body);
  const hasContact = Boolean(home.contact.phone || home.contact.email || home.contact.address || home.contact.hours.length);

  // Links to sections that are not on the page are dead ends — add them only
  // when the section exists.
  home.footer = {
    ...d.footer,
    blurb: text(hero.subhead) || text(seo.description) || d.footer.blurb,
    columns: [
      ...d.footer.columns.map((col) => (col.title === 'Help' && hasContact
        ? { ...col, links: [...col.links, { label: 'Contact', url: '/#contact' }] }
        : col)),
      ...(hasAbout ? [{ title: 'Company', links: [{ label: 'About', url: '/#about-band' }] }] : []),
    ],
  };
  if (!hasAbout && d.hero_cta_secondary_url === '#about-band') home.hero_cta_secondary_label = '';

  return {
    brand: { name, logoUrl },
    seo: {
      title: text(seo.title) || (BRAND.tagline ? `${name} — ${BRAND.tagline}` : name),
      description: text(seo.description) || text(hero.subhead) || BRAND.description,
    },
    hasAbout,
    hasContact,
    home,
    promos: DEFAULTS.promos,
  };
}

/** Same shape as buildSiteContent, for a site with no saved storefront. */
export const DEFAULT_CONTENT = buildSiteContent(null);
