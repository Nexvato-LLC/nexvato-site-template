# Nexvato Site Template

The starting point for every client website/storefront. New sites are
**generated** from this repo (not forked), so each client starts at commit 1
with clean history. Push to `main` and it deploys.

---

## Building a new client site — edit these first

| File | What's in it |
|---|---|
| `lib/brand.js` | **Start here.** Business name, tagline, description. Feeds the page title, social previews, structured data, header and footer. |
| `lib/content.js` | All homepage and footer copy — headlines, CTAs, the about band, navigation links. |
| `lib/data.js` | The brand/category filter lists shown on `/shop`. Empty by default. |
| `styles/ds/tokens/colors.css` | The whole palette. Semantic names (`--brand-royal`, `--surface-navy`) stay put; change the primitives at the top and the entire site re-themes. |
| `public/assets/` | Logo, hero, promo and about imagery. Ships as neutral SVG placeholders — replace them. |

Nothing is hardcoded to a brand. Editing those five gets you a distinct site
without touching a component.

---

## What the platform manages — don't edit

These are injected automatically when the site is provisioned:

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SHOP_ID` | which store this site sells |
| `NEXT_PUBLIC_SHOP_API_URL` | the Nexvato commerce API |
| `NEXT_PUBLIC_SITE_URL` | the public URL (canonicals + sitemap) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | checkout key (publishable — not a secret) |

⚠️ **Only `NEXT_PUBLIC_*` values are ever injected, and every one of them is
public.** They ship inside the browser bundle. Never put a secret in this repo
and never expect the platform to hand you one — anything sensitive belongs
behind the API, not in a site anyone can view-source.

If `NEXT_PUBLIC_SHOP_ID` is missing, the site renders a red banner saying so.
That is deliberate: a site with no shop id builds fine, deploys fine, returns
200, and sells nothing — indistinguishable from a store with no products. That
failure shipped once and cost a day to find.

---

## What's in the box

- Homepage with animated hero, featured products, promo cards, about band, newsletter
- `/shop` with category + brand filters, price and rating facets
- Product detail pages with variants and add-to-cart
- Slide-out cart, full checkout with Stripe, order confirmation
- Customer accounts: register, sign in, order history, saved addresses
- `sitemap.xml`, `robots.txt`, canonical URLs, Open Graph and structured data
- A design system in `components/ds/` — buttons, inputs, badges, price tags, product cards

Products, pricing, stock and orders all come from the client's Nexvato
dashboard. A price change goes live **without a deploy**.

---

## Local development

```bash
npm install
cp .env.example .env.local     # add the shop id
npm run dev
```

## Deploying

Push to `main`. That's the whole process — the build runs and the site goes
live. Deployment status is visible in the Nexvato dashboard.

---

## How data flows

`lib/shop.js` is the only file that talks to the platform, and it is the one
place where **cents become dollars**. The API speaks integer cents; the
components speak dollars. Keep that conversion where it is — a missed division
scattered through a component is a 100× pricing bug.
