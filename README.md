# Na Nomery — car import tax calculator

Free, client-side calculator of what it costs to clear customs and register a car: duty, excise, VAT and registration taxes at official rates, plus mandatory registration costs. Route: any of 43 purchase countries (USA, Canada, Mexico, EU-27, Ukraine, Japan, Korea, UK, Switzerland, Norway, Georgia, UAE, China, Turkey, Moldova, Serbia, Australia) → Ukraine or any of the 27 EU countries. 23 languages, auto-detected.

## What is real and what is estimated
- **Taxes** come from official sources only, linked in every “?” popover: Tax Code / Customs Tariff / Law 400/97 (zakon.rada.gov.ua), customs.gov.ua, Ley 38/1992 (boe.es), AEAT, DGT, Ustawa o podatku akcyzowym (isap.sejm.gov.pl), zoll.de, TARIC, Taxes in Europe Database (EU VAT rates), Regulation (EC) 1186/2009.
- **Fully computed:** Ukraine (duty, excise, VAT, pension levy), Spain (arancel, IVA, IEDMT by CO₂ with the Hacienda depreciation table), Poland (duty, akcyza, VAT), Germany (duty, import VAT).
- **Other EU countries:** duty 10% + national VAT are computed; the national registration tax is *not* invented — it is listed as “not included” with a link to the country’s customs authority.
- **Registration costs** (certificate of conformity, homologación, ITV, DGT fee, plates, mandatory lighting conversion) are marked as market estimates in their “?”.

## Data
- VIN: NHTSA vPIC (free, CORS). Cross-checked with the EPA catalogue and a curated list of European equivalents (WLTP CO₂, list prices) in `src/data/models.json`.
- Catalogue: `public/catalog/` — every model sold in the USA 1984–2026 (45k engine versions), built from fueleconomy.gov by `npm run catalog`.
- FX: National Bank of Ukraine, live with a fallback.
- Rules: `src/data/rules.ukraine.json`, `rules.spain.json`, `countries.json` (EU VAT rates, customs sites, Polish excise), `origins.ts` (purchase country → rule group).

## Share links and the backend
Share links look like `domain/uk/hr9m`. Codes are stored by a tiny backend in `server/` (Node 24, `node:sqlite`, zero dependencies): `POST /s` → `{code}`, `GET /s/:code`, `GET /geo`, `GET /health`, rate limiting, duplicate de-duplication, hit counter. Run it with `npm run server` (port 8787, database `server/data/links.sqlite`) or the Dockerfile in `server/`. `worker/` holds an equivalent Cloudflare Worker + KV implementation if you prefer serverless. Point the app at it with `VITE_SHARE_API` (`.env.development` already targets `http://localhost:8787`). Without a backend the app falls back to a self-contained `#s=…` link.

State is never lost on reload: the selected countries live in the URL (`?from=LT&to=ES`) and the whole draft is kept in localStorage.

## Development
```sh
npm install
npm run server     # share backend on :8787
npm run dev        # app on :5173 (uses .env.development)
npm test
npm run build      # vite build + per-language prerender (SEO), sitemap.xml, robots.txt
```
Deploy: GitHub Pages via `.github/workflows/deploy.yml` (set the repository variable `VITE_SHARE_API` to the backend URL). SEO: one `index.html` per language with localized title/description, canonical, hreflang, JSON-LD.
