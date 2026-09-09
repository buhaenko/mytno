# CLAUDE.md — mytno.app (~/homeprojects/mytno)

Read this first. It is the only context file for this project; keep it current at the end of
every session and do not create notes, docs folders or summaries anywhere else.

## What this is

**mytno.app** — a free calculator for what it costs to clear customs and register a car:
duty, excise, VAT, registration taxes and the mandatory registration costs, at official rates.
Route: any of 43 purchase countries → Ukraine or any of the 27 EU countries. 23 languages,
19 currencies, 667 prerendered pages. **Live at https://mytno.app.**

It grew out of a real question: Serhii lives in Spain, a friend in Ukraine has an Audi A4 (US
import, VIN `WAUANAF42HN008179`), and nobody could say what bringing it over would actually cost.

## Working rules

- **Only real data.** Every rate comes from an official source and is linked next to the line it
  produces. Where a country's registration tax follows a national formula we do not replicate, the
  line is shown, marked “not in total”, and linked to that country's authority. Never invent a number.
- **Config, not code.** Rates, thresholds, sources and reference tables live in `config/*.json`.
  Editing a rate is editing one JSON file, not hunting through modules.
- **Code in English** — identifiers, comments, commit messages. Chat with Serhii in Ukrainian.
- **Aesthetics matter.** One concern per file, a header comment saying why the file exists, short
  templates, no dead CSS. Serhii reads the code and wants it to look considered.
- **Look at it before saying it works.** No browser test runner is installed, but Chrome is:
  `npm run build && npx vite preview --port 4173`, then headless Chrome over the DevTools protocol
  — navigate, click, read `location.search`, `innerText`, `performance.getEntriesByType('resource')`
  and the console, and screenshot at 390px and 1280px. The small CDP scripts live in the session
  scratchpad, not in the repo. Every layout and behaviour claim in this file was checked that way.
- **Deploy is a push.** `git push` runs the tests, builds and uploads to Cloudflare Pages. Verify on
  the live domain afterwards; a page fetched seconds into a deploy can 404 on one edge.

## Run it

```sh
npm install
npm run dev          # the site on :5173, nothing else to start
npm test             # 15 calculation tests
npm run build        # vite build + 667 prerendered pages, sitemap, robots
npm run catalog      # rebuild public/catalog from the EPA dataset
```

There is no server, no database and no `.env` to fill in. `.env.example` holds two analytics ids
and `SITE_URL`, all optional. Two runtime dependencies: `vue` and `flag-icons`.

## Layout

```
config/                    single source of truth — rules, rates, currencies, sources, settings
src/
  types.ts                 Vehicle · Trip · Money · Line · Estimate · Msg · Currency (19)
  state/                   calculator (7 values, everything else derives) · snapshot (URL ⇄ state)
  lib/calc/                ukraine · spain · eu (generic + Austria + Poland) · common
  lib/vehicle/             vin · decode · catalog · reference · identify
  lib/                     money · fx · url · pages · countrySources · analytics · origins
  components/layout/       TopBar · Hero · StepSection · CountryBrief · CountryLinks · SiteFooter
  components/              controls · vehicle · result · icons
  styles/                  tokens · base · layout · controls · result · footer · motion
  i18n/                    locales.ts + one message file per language (239 keys each)
scripts/                   prerender (667 pages, sitemap, robots) · build-catalog
```

## What is calculated

| Destination | Computed |
| --- | --- |
| Ukraine | duty 10% (0% for EU-built with EUR.1, 0% for EV), excise (€/L × age factor, 1 €/kWh for EV, €100 flat for hybrids), VAT 20%, pension levy 3/4/5% |
| Spain | arancel 10%, IVA 21%, IEDMT by CO₂ (0 / 4.75 / 9.75 / 14.75%) on the Hacienda table price × age coefficient |
| Poland | duty, akcyza 3.1% / 18.6% (reliefs for hybrids and EVs), VAT 23% |
| Austria | duty, VAT 20%, **NoVA**: `(CO₂ − 91) / 5` of the price, max 80%, minus €350, plus €80 per gram above 155 g/km. Verified against bmf.gv.at, rates in force from 1 Jan 2026 |
| DE BG LU RO SE LV | duty + national VAT; registration tax declared a real €0 — **only DE, RO and BG re-checked; LU, SE and LV are inherited and unverified** |
| the other 18 EU countries | duty 10% + national VAT; the registration tax is shown as “not in total” with a link to the authority, because it needs an official table we have not built |

Market estimates, labelled as such in their “?”: certificate of conformity, homologación, ITV,
DGT fee, plates, mandatory lighting conversion.

## Facts worth not re-deriving

- **EU VAT rates**: Taxes in Europe Database, as of 1 July 2025; Romania went to 21% on 1 Aug 2025.
- **Estonia has charged a registration fee since 1 Jan 2025** — a base part plus CO₂ and mass parts,
  administered by Transpordiamet, rising again in 2028 and 2031. The config called it €0 until
  9 Sep 2026, which was simply wrong; it is `national` now.
- **Czechia charges an emission fee once**, on the first registration of an import: 3 000 CZK for
  EURO 2, 5 000 for EURO 1, 10 000 for no standard, nothing from EURO 3 up (Act 542/2020 Sb.). It is
  derivable from the model year — EURO 3 from January 2001 — so it could be computed rather than
  merely linked, and that is worth doing.
- **Registration taxes are the weak spot.** Four are computed from official tables (UA ES PL AT).
  The rest is either a declared zero or a link, and only some of the zeros have been re-checked.
  Estonia proved the risk: a country's answer can change under a config that nobody revisits.
- **Bulgaria joined the euro on 1 Jan 2026.** The ECB's last lev observation is 2025-12-31, so there
  is no BGN in the app and `BG` maps to the euro. AE, GE, MD and RS map to the euro too: no bank
  reachable from a browser publishes their currencies.
- **Which banks answer a browser.** With CORS: `data-api.ecb.europa.eu` (the ECB's other host,
  `eurofxref-daily.xml`, sends no header), `api.nbp.pl`, `data.norges-bank.no`, `bank.gov.ua`,
  `vpic.nhtsa.dot.gov`. Probed and rejected: SNB, the Bank of England, ČNB, Riksbank, MNB, BNR, BNB.
  The ECB publishes no hryvnia — `D.UAH.EUR.SP00.A` is a 404 — which is why the NBU is asked directly.
- **Duty on cars from outside the EU**: 10%, TARIC heading 8703. Depends on the country of
  *manufacture*, not of purchase.
- **VIN**: position 9 is a checksum only on North American VINs; VW Group writes `ZZZ` in positions
  4–6 on non-US cars. That is how the market is detected, and the market decides whether EU type
  approval is needed.
- **NHTSA** decodes US-market VINs fully and European ones barely (make, year, plant). The gaps for
  Spain and Austria (WLTP CO₂, list price) come from `config/models.json`, a hand-checked list.
- **rdap.org returns 403**; Google Registry RDAP lies (says `google.app` is free), and `whois` on a
  `.app` name answers with the TLD record, which reads as “registered” for everything. So a `.app`
  domain is checked by DNS: NXDOMAIN on Cloudflare, Google and Quad9 means free. For `.com` use
  Verisign RDAP, for `.io` plain whois.
- **Domains** (checked 9 Sep 2026): `mytno.app` is **bought** on Cloudflare Registrar. At cost there,
  `.app` is $14.20/year and `.io` is $50.00/year, registration and renewal alike — which is why the
  name is not `mytno.io`. Free that day if it ever has to move: `mytn.app`, `rozmyt.app`, `klir.app`,
  `mytto.app`, `tarifo.app`. Taken: `myto.*`, `myt.app`, `vin.app`, `duty.app`, `vinta.*`, `kosht.*`.

## Decisions already made

- **There is no backend.** Everything runs in the browser: the rules are bundled JSON, the VIN goes
  to NHTSA and the rates to four central banks, all of which answer cross-origin;
  `config/fx.fallback.json` covers any of them being down. Deleted along with the Fastify API: share
  codes, the VIN and rate caches, the geo language guess and `docker-compose`. Do not reintroduce a
  server for caching — it buys nothing a static host and public APIs do not already give.
- **The address bar is the share link.** State lives in the URL and nowhere else — no localStorage,
  no share codes: the language is a path segment (`/uk/`), the calculation is a readable query
  (`?from=US&to=UA&vin=…&price=20000&cur=USD&show=EUR`), written once the first screen is restored
  and again on every change. Every value on screen is in it, the currency the total is *read* in
  (`show`) included, so copying the address reproduces the screen exactly. That is the whole sharing
  mechanism, which is why there is no share button.
- **A page per country, in every language — 667 in all.** `/uk/import/es/`, `/de/import/se/`: the
  place a car is registered, its rates, the official source behind each one and the two questions
  people ask, with the calculator underneath and the destination already chosen. The text is built
  by `countryBrief()` in `src/lib/pages.ts`, which imports nothing — `scripts/prerender.mjs` runs the
  same function in Node with the JSON read from disk, so what a crawler reads and what the app
  renders cannot drift apart. The country name always leads (`Іспанія: розмитнення авто`) because no
  language then has to decline it; the FAQ ships as `FAQPage` structured data. Every page carries the
  country index as plain links, so a crawler reaches all 667 from any one of them.
- **Every amount is held in euro**, and each rate says what one euro buys — from the bank that
  publishes it wherever that bank answers a browser: **zloty** from Narodowy Bank Polski, **krone**
  from Norges Bank, **hryvnia** from the National Bank of Ukraine. The other fifteen come from the
  ECB reference rate in one request (`D.USD+GBP+CHF+CZK+SEK+DKK+HUF+RON+JPY+KRW+CNY+AUD+CAD+MXN+TRY`,
  SDMX-CSV). No rate is derived through another: the old code crossed USD and EUR through the
  hryvnia, which put a Ukrainian rate inside a Spain→Germany calculation. Every quote carries its
  own date and source and every bank is asked in parallel, so one failing costs only its currency.
- **The country picks the currency**, `config/currencies.json`: the price follows the country of
  purchase, the total follows the country of registration — Poland is zloty, Norway is kroner,
  Czechia is koruna, everything unlisted is euro. The watchers are `flush: 'sync'` so that a currency
  named in the URL, applied right after the countries, still wins over the guess. Nothing else is
  picked for the visitor: an empty query chooses no country and no destination. An early version
  defaulted the destination to Ukraine, which made the tool look Ukrainian.
- **The result names only the rates it used** — the currency the price was paid in and the one the
  total is read in — one line each, linked to the bank that published it. `config/countries.json` →
  `fxSources` holds their names; adding a currency is a loader, a fallback line and an entry there.
- **The title says what the tool does, not where.** Naming Ukraine and three EU countries in the
  meta description read as a Ukrainian tool with a European footnote; it gives the scope instead —
  43 countries of purchase, 28 destinations.
- **Design**: soft off-white canvas `#F4F4F6`, near-white surfaces, hairline borders, no shadows on
  cards, Inter only (no display serif), JetBrains Mono for the small labels, one warm orange accent
  `#E2662A` used sparingly. Everything explanatory hides behind a “?”. The steps are labels, not
  numbers — an accent dot, the mono label, a rule. Each country of purchase carries its customs group
  on the right in quiet mono — USA, EUROPE, UKRAINE, JAPAN, KOREA, OTHER — in the list and on the
  closed button, because that group, not the country, decides the rules; the label is the same
  `car.market.*` string the vehicle step uses, and Ukraine borrows the country name.
- **The footer is one line**: `© year mytno.app · Legal and data ? · feedback@mytno.app · updated`.
  Everything legal lives in that single tip — the disclaimer, what “official source” means, the data,
  privacy and liability notes, and three official sources as examples. It was four stacked paragraphs
  of small print before, which is three too many, and the name was repeated in each of them.
- **The favicon is not the wheel mark.** The mark has five thin spokes and a hairline rim, which at
  16 pixels turns to mush; the icon is a solid white disc with five cut spokes and the orange hub, on
  the dark square (`public/favicon.svg`, with a 32px PNG and a full-bleed 180px apple-touch beside
  it). Judged by rendering it at 16, 20, 24, 32 and 56 pixels and looking, not by taste at full size.
- **The wheel mark** spins on hover, adds momentum on a second hover instead of restarting, and
  wobbles because it turns a few units off centre. Its SVG has `overflow: visible` so the wobble is
  not clipped — do not “fix” that by re-centring it.
- **Analytics** stays off until an id is set: Plausible (cookieless, no banner) or GA4 behind the
  consent bar. Both configured in `config/site.json` or via env.
- **Cloudflare, done over the API.** Zone `mytno.app`: two proxied `CNAME`s, apex and `www`, both to
  `mytno.pages.dev`. Adding a custom domain through the API does **not** create the DNS record the
  way the dashboard does — the domain sits in `pending` until the record exists. Note the shape of a
  Cloudflare token: DNS records and Email Routing rules are **zone**-scoped permissions, so a token
  with every account permission still cannot touch them.

## Where things stand

Live, tested and pushed. HEAD `af02709`.

- **Hosting.** Repository `buhaenko/mytno` (public) → Cloudflare Pages project `mytno` (direct
  upload; connecting a repository is an OAuth flow in the dashboard, not an API call).
  `.github/workflows/ci.yml` tests, builds and uploads `dist` with `wrangler-action` on every push to
  `main`; the secrets `CLOUDFLARE_API_TOKEN` (Pages Write only) and `CLOUDFLARE_ACCOUNT_ID` live in
  the repository. `public/_headers` carries the caching and security headers, verified in the live
  responses. GitHub Pages is switched off, and `VITE_BASE` — which existed only for it — can go.
- **Two GitHub accounts.** `gh` is logged in as **buhaenko**, the personal one and the only one this
  project goes to; the machine's SSH key belongs to `SerhiiBuhaenko`. The remote is therefore HTTPS
  through the `gh` credential helper — do not switch it back to SSH.
- **Email.** `feedback@mytno.app` forwards through Cloudflare Email Routing to
  `buhaienko.serhii@gmail.com` (verified).

**Next, in the order it is worth doing:**
1. **Google Search Console** — the site is not verified anywhere, so nothing is submitted. Needs a
   verification token from Serhii; then the sitemap of 667 URLs goes in and indexing starts in days
   rather than weeks. Bing Webmaster imports from it in two clicks.
2. **`og:image`** — there is none, so every share is a wall of text. 1200×630, drawn in the site's
   own type, plus `twitter:card summary_large_image`.
3. **IndexNow** in CI: a key file at the root and a ping on every deploy.
4. **Route pages** — `/uk/import/us-ua/`, about thirty of them, not the 1204 the grid allows. The
   country pages are the pattern to follow.
5. **More registration taxes worth computing**, each needs its official table: Netherlands BPM,
   France malus, Ireland VRT, Portugal ISV, Finland autovero.
6. **Before real traffic**: Sentry, UptimeRobot, and a redirect rule so `www.mytno.app` goes to the
   apex instead of serving a second copy (the canonical tag covers it for now).

## History

- **09-08** Built from scratch in `~/work/vin-import-calc`: VIN decode, EPA catalogue (45 391 engine
  versions, 1984–2026), Ukraine and Spain rules, 23 languages, SEO prerender, share links.
- **09-09** The whole rest of it, in one day:
  - Added the EU-27, Austrian NoVA, the legal footer, a Fastify + Mongoose backend and the shared
    `config/`. Rewrote the frontend for readability.
  - Renamed Vinta → Tarifo → **mytno.io** → **mytno.app**, moving to `~/homeprojects/mytno`. The last
    hop was price: `.io` costs $50 a year against $14.20 for `.app`.
  - Pushed to `buhaenko/mytno`, briefly on GitHub Pages, then bought the domain, created the
    Cloudflare Pages project, pointed the domain at it over the API and switched GitHub Pages off.
  - **Deleted the backend entirely** — `server/`, `docker-compose.yml`, `Dockerfile.web`,
    `nginx.conf`, `src/lib/api.ts`, `shareLink.ts`, `state/share.ts`, `ShareField.vue` — and with it
    Fastify, Mongoose and `mongodb-memory-server`. Share codes went too: the address bar carries the
    calculation, so people copy that.
  - Split the exchange rates four ways and grew them from three currencies to nineteen, each from
    the bank that publishes it; the country of the route now picks the currency.
  - Made the footer one line, dropped the numbers from the step headings, moved the country name to
    the front of every heading, and redrew the favicon for 16 pixels.
  - **667 pages**: the calculator in 23 languages and a page per destination country in each, with
    rates, sources, FAQ schema and a country index for crawlers.
