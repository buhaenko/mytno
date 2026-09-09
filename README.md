# mytno.app — car import tax calculator

What it costs to clear customs and register a car: duty, excise, VAT and registration taxes at official
rates, plus the mandatory registration costs. Route: any of 43 purchase countries → Ukraine or any of the
27 EU countries. 23 languages, picked automatically.

## Run it locally

```sh
npm install
npm run dev          # the site on :5173
```

That is the whole setup. There is no server and no database to run: the calculator is a static site
that talks to two public APIs from the browser. `.env` is optional — `.env.example` holds the two
analytics ids and the canonical `SITE_URL`.

```sh
npm test             # calculation tests
npm run build        # site build + a prerendered page per language, sitemap.xml, robots.txt
npm run catalog      # rebuild the vehicle catalogue from the EPA dataset
```

## How it is put together

```
config/                    the single source of truth — rules, rates, sources (plain JSON)
src/
  types.ts                 the vocabulary: Vehicle, Trip, Money, Line, Estimate
  state/                   calculator (the seven values everything derives from) · snapshot
  lib/calc/                ukraine · spain · eu (generic, plus Austria and Poland)
  lib/vehicle/             vin · decode · catalog · reference · identify
  lib/                     money · fx · url · analytics · origins
  components/              layout · controls · vehicle · result · icons
  styles/                  tokens · base · layout · controls · result · footer · motion
  i18n/                    locales.ts and one message file per language
scripts/                   prerender (SEO) and the catalogue builder
```

**`config/` is the point.** Every rate, threshold, source link and reference table lives there as JSON,
not in code, and it is bundled straight into the app. Editing a rate is editing one JSON file.

**No backend.** The rules are local files and the browser talks to the two public services itself —
both send `access-control-allow-origin: *`, so no proxy is needed:

| Service | Used for | If it is down |
| --- | --- | --- |
| NHTSA vPIC | VIN decoding | the EPA catalogue still identifies the car |
| European Central Bank | the dollar rate | `config/fx.fallback.json`, marked as a fallback |
| National Bank of Ukraine | the hryvnia rate | `config/fx.fallback.json`, marked as a fallback |

**Sharing is copying the address bar.** The language is a path segment and the calculation is a readable
query string, rewritten as the numbers change, so any result is a plain URL: nothing is minted, stored
or shortened.

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

The site is static output in `dist/`: any file host will serve it.

**Cloudflare Pages.** Connect the repository and keep the defaults — the build settings
it needs are in the repository already:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | from `.node-version` (22) |
| `SITE_URL` | `https://mytno.app` — canonical links, hreflang and the sitemap |

`public/_headers` sets the caching and the security headers. Unknown paths fall back to the
prerendered `404.html`, which boots the app.
Leave `VITE_BASE` unset: it exists for GitHub Pages, which serves the site from a subdirectory.

GitHub only runs the checks: `.github/workflows/ci.yml` builds and tests every push to `main`.
Deployment is Cloudflare's alone.

Analytics is off until configured: set `VITE_PLAUSIBLE_DOMAIN` (cookieless, no banner) or `VITE_GA_ID`
(Google Analytics 4, loaded only after the visitor accepts in the consent bar).
