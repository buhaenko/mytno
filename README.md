# mytno.app — car import tax calculator

What it costs to clear customs and register a car: duty, excise, VAT and registration taxes at official
rates, plus the mandatory registration costs. Route: any of 43 purchase countries → Ukraine or any of the
27 EU countries. 23 languages, picked automatically.

## Run it locally

```sh
npm install
npm run dev          # API on :8787 (embedded MongoDB) + site on :5173
```

One command is enough: with no `MONGO_URL` the API starts an embedded MongoDB and keeps its files in
`server/.data/mongo`, so nothing has to be installed. Copy `.env.example` to `.env` to change anything.

```sh
npm test             # calculation tests
npm run build        # site build + a prerendered page per language, sitemap.xml, robots.txt
npm run catalog      # rebuild the vehicle catalogue from the EPA dataset
docker compose up    # MongoDB + API + nginx, the shape of a production deploy
```

## How it is put together

```
config/                    the single source of truth — rules, rates, sources (plain JSON)
server/src/                Fastify + Mongoose
  config.js                every setting and every upstream URL, in one file
  app.js                   the API in one readable list of registrations
  db.js                    connection (embedded MongoDB in development)
  models/                  ShareLink · VinDecode · ExchangeRate, with their indexes and TTLs
  routes/                  health · config · rates · vin · share · geo
  services/                codes (share links) · rates (National Bank) · vin (NHTSA)
src/
  types.ts                 the vocabulary: Vehicle, Trip, Money, Line, Estimate
  state/                   calculator (the seven values everything derives from) · snapshot · share
  lib/calc/                ukraine · spain · eu (generic, plus Austria and Poland)
  lib/vehicle/             vin · decode · catalog · reference · identify
  lib/                     money · fx · api · shareLink · analytics · origins
  components/              layout · controls · vehicle · result · icons
  styles/                  tokens · base · layout · controls · result · footer · motion
  i18n/                    locales.ts and one message file per language
scripts/                   prerender (SEO) and the catalogue builder
```

**`config/` is the point.** Every rate, threshold, source link and reference table lives there as JSON,
not in code. The API serves the same files at `/api/config`, so what the site calculates with can be read
and audited without a build. Editing a rate is editing one JSON file.

**External services are optional.** The tax rules are local files. Only two things come from outside, both
proxied and cached by our API so the site keeps working when they do not:

| Service | Used for | If it is down |
| --- | --- | --- |
| NHTSA vPIC | VIN decoding | cached decodes are reused; the catalogue still works |
| National Bank of Ukraine | exchange rates | last good rate, then `config/fx.fallback.json` |

Without `VITE_API_URL` the site runs with no backend at all: it calls those services directly and makes
self-contained share links. That is the static-hosting mode.

## What is calculated and what is not
- **Fully computed:** Ukraine (duty, excise, VAT, pension levy), Spain (arancel, IVA, IEDMT by CO₂ with
  the Hacienda depreciation table), Poland (duty, akcyza, VAT), Austria (duty, VAT, NoVA by CO₂),
  Germany and the other countries whose registration tax is a real zero.
- **Listed but not computed:** the national registration tax in countries where it follows a national
  formula and an official valuation. It appears as a row marked “not in total” with a link to that
  country's authority, because inventing a number would be worse than showing none.
- **Market estimates**, marked as such in their help popover: certification, individual type approval,
  ITV, plates and the mandatory lighting conversion.

## Deploying

The site is static output in `dist/` and needs no backend. The API (`server/`) needs Node and a
MongoDB; its requests are validated by JSON Schema at the route and rate limited per IP.
`docker compose up` runs the whole thing locally in the shape of a production deploy.

**The site on Cloudflare Pages.** Connect the repository and keep the defaults — the build settings
it needs are in the repository already:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | from `.node-version` (22) |
| `SITE_URL` | `https://mytno.app` — canonical links, hreflang and the sitemap |
| `VITE_API_URL` | the API's address, only if one is deployed |

`public/_headers` sets the caching and the security headers. Unknown paths fall back to the
prerendered `404.html`, which boots the app, so share links of the form `/uk/f4uz` resolve.
Leave `VITE_BASE` unset: it exists for GitHub Pages, which serves the site from a subdirectory.

**The same build also deploys to GitHub Pages** on every push to `main`
(`.github/workflows/deploy.yml`), which runs the tests first. It is the staging copy;
Cloudflare is the one that gets the domain.

Analytics is off until configured: set `VITE_PLAUSIBLE_DOMAIN` (cookieless, no banner) or `VITE_GA_ID`
(Google Analytics 4, loaded only after the visitor accepts in the consent bar).
