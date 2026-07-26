# Nexvato Site Template

The starting point for a client website/storefront on the Nexvato platform.
Every client site is generated from this repo, then owned and deployed
independently — **push to `main` and it deploys.**

## What the platform manages

These are injected automatically when the site is provisioned. You do not set
them by hand, and changing them here has no effect:

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SHOP_ID` | which store this site sells |
| `NEXT_PUBLIC_SHOP_API_URL` | the Nexvato commerce API |
| `NEXT_PUBLIC_SITE_URL` | the site's public URL (canonicals + sitemap) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | checkout key (publishable — not a secret) |

⚠️ **Only `NEXT_PUBLIC_*` values are ever injected, and all of them are public.**
They ship in the browser bundle. Never add a secret to this repo or expect the
platform to hand you one — anything sensitive belongs behind the API, not in a
site that anyone can view-source.

## What you own

Everything else. Layout, styling, components, extra pages, SEO, animation,
analytics, the whole design. That is the point of having your own repo: the
catalog, pricing, stock and orders stay managed in the dashboard while the
presentation is entirely yours.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your shop id
npm run dev
```

## How data flows

`lib/shop.js` is the only file that talks to the platform. It reads the
catalog from the public commerce API — no auth, no keys, safe to call from
anywhere. Products, prices and stock always come from the dashboard, so a
price change goes live without a deploy.

Catalog responses are cached for 60 seconds, so dashboard edits appear within
about a minute without rebuilding.

## Deploying

Push to `main`. That is the whole process — the build runs and the site goes
live. Check the deployment status from your Nexvato dashboard.
