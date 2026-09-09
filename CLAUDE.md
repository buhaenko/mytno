# CLAUDE.md — mytno.app (~/homeprojects/mytno)

Read this first. It is the only context file for this project; keep it current at the end of
every session and do not create notes, docs folders or summaries anywhere else.

## What this is

**mytno.app** — a free calculator for what it costs to clear customs and register a car:
duty, excise, VAT, registration taxes and the mandatory registration costs, at official rates.
Route: any of 43 purchase countries → Ukraine or any of the 27 EU countries. 23 languages.

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
- Verify before asserting: run it, measure it, read the output. No browser test runner is
  installed — `npm test` (vitest) and the dev server are what there is.

## Run it

```sh
npm install
npm run dev          # the site on :5173, nothing else to start
npm test             # 15 calculation tests
npm run build        # vite build + a prerendered page per language, sitemap, robots
npm run catalog      # rebuild public/catalog from the EPA dataset
```

There is no server, no database and no `.env` to fill in. `.env.example` holds two analytics ids
and `SITE_URL`, all optional.

## Layout

```
config/                    single source of truth — rules, rates, sources, site settings
src/
  types.ts                 Vehicle · Trip · Money · Line · Estimate · Msg
  state/                   calculator (7 values, everything else derives) · snapshot
  lib/calc/                ukraine · spain · eu (generic + Austria + Poland) · common
  lib/vehicle/             vin · decode · catalog · reference · identify
  lib/                     money · fx · url · analytics · origins
  components/              layout · controls · vehicle · result · icons
  styles/                  tokens · base · layout · controls · result · footer · motion
  i18n/                    locales.ts + one message file per language (225 keys each)
scripts/                   prerender (SEO) · build-catalog
```

## What is calculated

| Destination | Computed |
| --- | --- |
| Ukraine | duty 10% (0% for EU-built with EUR.1, 0% for EV), excise (€/L × age factor, 1 €/kWh for EV, €100 flat for hybrids), VAT 20%, pension levy 3/4/5% |
| Spain | arancel 10%, IVA 21%, IEDMT by CO₂ (0 / 4.75 / 9.75 / 14.75%) on the Hacienda table price × age coefficient |
| Poland | duty, akcyza 3.1% / 18.6% (reliefs for hybrids and EVs), VAT 23% |
| Austria | duty, VAT 20%, **NoVA**: `(CO₂ − 91) / 5` of the price, max 80%, minus €350, plus €80 per gram above 155 g/km. Verified against bmf.gv.at, rates in force from 1 Jan 2026 |
| DE SE CZ BG RO LU EE LV | duty + national VAT; registration tax is a real €0 (only fixed admin fees) |
| the rest of the EU | duty 10% + national VAT; registration tax shown as “not in total” with a link to that country's customs |

Market estimates, labelled as such in their “?”: certificate of conformity, homologación, ITV,
DGT fee, plates, mandatory lighting conversion.

## Facts worth not re-deriving

- **EU VAT rates**: Taxes in Europe Database, as of 1 July 2025; Romania went to 21% on 1 Aug 2025.
- **Bulgaria joined the euro on 1 Jan 2026.** The ECB's last lev observation is 2025-12-31, so there
  is no BGN in the app and `BG` maps to the euro. AE, GE, MD and RS map to the euro too: no bank
  reachable from a browser publishes their currencies.
- **The ECB publishes no hryvnia.** `data-api.ecb.europa.eu/service/data/EXR/D.UAH.EUR.SP00.A` is a
  404 — its reference rates cover about thirty currencies and UAH is not among them. That is why
  there are two sources rather than one. The ECB's `eurofxref-daily.xml` sends no CORS header;
  `data-api.ecb.europa.eu` does, which is the one the browser can call.
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
- **Domains** (checked 9 Sep 2026): the name is **`mytno.app`**, not `.io` — at Cloudflare, at cost,
  `.app` is **$14.20/year** and `.io` is **$50.00/year**, registration and renewal alike. Nothing is
  bought yet. Also free that day: `mytn.app`, `rozmyt.app`, `klir.app`, `mytto.app`, `tarifo.app`,
  and on the expensive side `mytno.io`, `tarifo.io`, `dogana.io`. Taken: `myto.app`, `myto.io`,
  `myt.app`, `vin.app`, `duty.app`, `vinta.*`, `kosht.*`, `dogana.app`.

## Decisions already made

- **There is no backend.** Everything runs in the browser: the rules are bundled JSON, the VIN goes
  to NHTSA, the dollar rate to the ECB and the hryvnia to the National Bank of Ukraine, all of which
  answer `access-control-allow-origin: *`; `config/fx.fallback.json` covers either bank being down. Deleted
  along with the Fastify API: share codes, the VIN and rate caches, the geo language guess and
  `docker-compose`. Do not reintroduce a server for caching — it buys nothing a static host and two
  public APIs do not already give.
- **The address bar is the share link.** State lives in the URL and nowhere else — no localStorage,
  no share codes: the language is a path segment (`/uk/`), the calculation is a readable query
  (`?from=US&to=UA&vin=…&price=20000&cur=USD&show=EUR`), written once the first screen is restored
  and again on every change. Every value on screen is in it, the currency the total is *read* in
  (`show`) included, so copying the address reproduces the screen exactly. That is the whole sharing
  mechanism, which is why there is no share button.
- **Euro is the base and nothing is picked for the visitor.** Amounts are held in euro, and both the
  price field and the total start in euro; an empty query chooses no country, no currency and no
  destination. An earlier version defaulted the destination to Ukraine and switched the price
  currency by country of purchase, which made the tool look Ukrainian and moved fields on its own.
- **Design**: soft off-white canvas `#F4F4F6`, near-white surfaces, hairline borders, no shadows on
  cards, Inter only (no display serif), JetBrains Mono for the small labels, one warm orange accent
  `#E2662A` used sparingly. Everything explanatory hides behind a “?”. The steps are labels, not
  numbers — an accent dot, the mono label, a rule. Each country of purchase carries its customs
  group on the right in quiet mono — USA, EUROPE, UKRAINE, JAPAN, KOREA, OTHER — in the list and on
  the closed button, because that group, not the country, is what decides the rules. The label is
  the same `car.market.*` string the vehicle step uses; Ukraine borrows the country name. **The footer is one line**: `© year mytno.app ·
  Legal and data ? · feedback@mytno.app · updated`. Everything legal lives in that single tip — the
  disclaimer, what “official source” means, the data, privacy and liability notes, and three
  official sources as examples. It was four stacked paragraphs of small print before, which is
  three paragraphs too many, and the name was repeated in each of them.
- **The title says what the tool does, not where.** Naming Ukraine and three EU countries in the
  meta description read as a Ukrainian tool with a European footnote; it gives the scope instead —
  43 countries of purchase, 28 destinations.
- **The wheel mark** spins on hover, adds momentum on a second hover instead of restarting, and
  wobbles because it turns a few units off centre. Its SVG has `overflow: visible` so the wobble is
  not clipped — do not “fix” that by re-centring it.
- **Every amount is held in euro**, and each rate says what one euro buys — from the bank that
  publishes it wherever that bank answers a browser: **zloty** from Narodowy Bank Polski, **krone**
  from Norges Bank, **hryvnia** from the National Bank of Ukraine. The other fifteen come from the
  ECB reference rate in one request (`D.USD+GBP+CHF+CZK+SEK+DKK+HUF+RON+JPY+KRW+CNY+AUD+CAD+MXN+TRY`,
  SDMX-CSV). Probed and rejected for having no CORS header: SNB, the Bank of England, ČNB, Riksbank,
  MNB, BNR, BNB. No rate is derived through another: the old code crossed USD and EUR through the
  hryvnia, which put a Ukrainian rate inside a Spain→Germany calculation. Every quote carries its
  own date and source and every bank is asked in parallel, so one failing costs only its currency.
- **The country picks the currency**, `config/currencies.json`: the price follows the country of
  purchase, the total follows the country of registration — Poland is zloty, Norway is kroner,
  Czechia is koruna. The watchers are `flush: 'sync'` so that a currency named in the URL, applied
  right after the countries, still wins over the guess.
- **The result names only the rates it used** — the currency the price was paid in and the one the
  total is read in — one line each, linked to the bank that published it. `config/countries.json` →
  `fxSources` holds their names; adding a currency is a loader, a fallback line and an entry there.
- **Analytics** stays off until an id is set: Plausible (cookieless, no banner) or GA4 behind the
  consent bar. Both configured in `config/site.json` or via env.
- **Cloudflare, done over the API.** Zone `mytno.app`: two proxied `CNAME`s, apex and `www`, both to
  `mytno.pages.dev`. Adding a custom domain through the API does **not** create the DNS record the
  way the dashboard does — the domain sits in `pending` until the record exists. Note the shape of a
  Cloudflare token: DNS records and Email Routing rules are **zone**-scoped permissions, so a token
  with every account permission still cannot touch them.

## Where things stand

Everything above is built, tested and pushed. HEAD `7b88821`.

**Not done yet:**
1. ~~Nothing is pushed.~~ **Live at https://mytno.app** — repository `buhaenko/mytno` (public),
   deployed by CI to Cloudflare Pages. Note the two GitHub accounts: `gh` is logged in as
   **buhaenko** — the personal one, the only one this project goes to — while the machine's SSH key
   belongs to `SerhiiBuhaenko`. So the remote is HTTPS and git authenticates through the `gh`
   credential helper; do not switch it back to SSH. GitHub Pages is switched off.
2. ~~No domain bought.~~ `mytno.app` is bought and serving. `SITE_URL` needs no variable anywhere:
   the prerender already defaults to `https://mytno.app`.
3. ~~No contact email.~~ `feedback@mytno.app` works: Cloudflare Email Routing forwards it to
   `buhaienko.serhii@gmail.com` (verified). The address is in `config/site.json` and the footer
   invitation is translated into all 23 languages (`footer.contact`).
4. **More registration taxes worth computing**, each needs its official table: Netherlands BPM,
   France malus, Ireland VRT, Portugal ISV, Finland autovero.
5. ~~Cloudflare Pages is not connected.~~ Project **`mytno`** (direct upload, not git-connected —
   connecting a repository is an OAuth flow in the dashboard, not an API call). `.github/workflows/
   ci.yml` tests, builds and uploads `dist` with `wrangler-action` on every push to `main`; the
   secrets `CLOUDFLARE_API_TOKEN` (Pages Write only) and `CLOUDFLARE_ACCOUNT_ID` live in the
   repository. `public/_headers` carries the caching and security headers — verified in the
   responses from the live domain. `VITE_BASE` stays unset, and can now go for good along with the
   note in `vite.config.ts`: nothing serves the site from a subdirectory any more.
6. **Still worth doing before launch**: Sentry and UptimeRobot; `www.mytno.app` serves the site
   rather than redirecting to the apex (the canonical tag covers it, a redirect rule would be
   tidier).

## History

- **09-08** Built from scratch in `~/work/vin-import-calc`: VIN decode, EPA catalogue (45 391 engine
  versions, 1984–2026), Ukraine and Spain rules, 23 languages, SEO prerender, share links.
- **09-09** Added the EU-27, Austrian NoVA, the legal footer, the Fastify + Mongoose backend and the
  shared `config/`. Rewrote the whole frontend for readability. Renamed from Vinta to Tarifo and
  moved to `~/homeprojects/tarifo`. Removed from the `~/work/CLAUDE.md` repository table.
  Renamed again to **mytno.app** — the brand is written in full, domain and all, everywhere it is
  visible (titles, og tags, footer in all 23 languages); identifiers, the repository and the Mongo
  database stay plain `mytno`. It was `mytno.io` for a few hours until the price came up: `.io`
  costs $50 a year against $14.20 for `.app`, so only the TLD moved. Pushed to `buhaenko/mytno`, deployed to GitHub Pages, and the working directory
  moved to `~/homeprojects/mytno`. The deploy workflow was passing `VITE_SHARE_API`, a name nothing
  reads; it was corrected, and then removed with the rest of the backend. Bought `mytno.app`,
  created the Cloudflare Pages project, pointed the domain at it and switched GitHub Pages off;
  `feedback@mytno.app` forwards through Email Routing. Split the exchange rates: the dollar now
  comes from the ECB and only the hryvnia from the National Bank.
  **Deleted the backend entirely.** `server/`, `docker-compose.yml`, `Dockerfile.web`, `nginx.conf`,
  `src/lib/api.ts`, `src/lib/shareLink.ts`, `src/state/share.ts` and `ShareField.vue` are gone, and
  with them Fastify, Mongoose and `mongodb-memory-server` — five runtime dependencies down to two.
  Share codes went with them: the address bar carries the calculation, so people copy that. Checked
  the result in headless Chrome against the built site: a query-string URL restores the car and the
  price, the National Bank answers the browser directly (the total moved by €7 when the live rate
  replaced the bundled one), NHTSA decodes the Audi cross-origin, and the page logs no errors.
