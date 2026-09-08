# На номери · Car import tax calculator

Free, client-side calculator of what it costs to clear customs and register a car: duty, excise, VAT and registration taxes at official rates, plus mandatory registration costs. Route: 🇺🇸 USA / 🇪🇺 EU / 🇺🇦 Ukraine / 🇯🇵 Japan / 🇰🇷 Korea → 🇺🇦 Ukraine and all 27 EU countries. 23 languages, auto-detected.

## What is real, what is estimated
- **Taxes** come from official sources only, linked in every “?”: Податковий кодекс / Митний тариф / Закон 400/97 (zakon.rada.gov.ua), customs.gov.ua, Ley 38/1992 (boe.es), AEAT, DGT, Ustawa o podatku akcyzowym (isap.sejm.gov.pl), zoll.de, TARIC, Taxes in Europe Database (EU VAT rates), Regulation (EC) 1186/2009.
- **Fully computed:** Ukraine (duty, excise, VAT, pension levy), Spain (arancel, IVA, IEDMT by CO₂ with Hacienda depreciation tables), Poland (duty, akcyza, VAT), Germany (duty, import VAT).
- **Other EU countries:** duty 10% + national VAT are computed; the national registration tax is *not* invented — it is listed as “not included” with a link to that country’s customs authority.
- **Registration costs** (certificate of conformity, homologación, ITV, DGT fee, plates, mandatory lighting conversion) are marked as market estimates in their “?”.

## Data
- VIN: NHTSA vPIC (free, CORS). Cross-checked with the EPA catalogue and a curated list of European equivalents (WLTP CO₂, list prices) in `src/data/models.json`.
- Catalogue: `public/catalog/` — every model sold in the USA 1984–2026 (45k engine versions) built from fueleconomy.gov by `npm run catalog`.
- FX: National Bank of Ukraine, live with a fallback.
- Rules: `src/data/rules.ukraine.json`, `rules.spain.json`, `countries.json` (EU VAT rates, customs sites, Polish excise).

## Share links
Short codes (`#c=ab3k9`) need the Cloudflare Worker in `worker/` (KV store, no database). Without `VITE_SHARE_API` the app falls back to self-contained links (`#s=…`). The worker also provides `/geo` for language detection by IP.

## Dev
```sh
npm install
npm run dev
npm test
npm run build      # vite build + prerender per language (SEO), sitemap.xml, robots.txt
```
Deploy: GitHub Pages via `.github/workflows/deploy.yml` (set repository variable `VITE_SHARE_API` if the worker is deployed).
