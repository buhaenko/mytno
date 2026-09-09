# CLAUDE.md — mytno.io (~/homeprojects/mytno)

Read this first. It is the only context file for this project; keep it current at the end of
every session and do not create notes, docs folders or summaries anywhere else.

## What this is

**mytno.io** — a free calculator for what it costs to clear customs and register a car:
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
npm run dev          # API on :8787 (embedded MongoDB) + site on :5173
npm test             # 15 calculation tests
npm run build        # vite build + a prerendered page per language, sitemap, robots
npm run catalog      # rebuild public/catalog from the EPA dataset
docker compose up    # mongo + api + nginx, the shape of a production deploy
```

`npm run dev` needs nothing installed: with no `MONGO_URL` the API starts a real MongoDB in-process
(`mongodb-memory-server`) and keeps its files in `server/.data/mongo`. Copy `.env.example` to `.env`
to change anything. `.env.development` already points the site at `http://localhost:8787`.

## Layout

```
config/                    single source of truth — rules, rates, sources, site settings
server/src/                Fastify + Mongoose
  config.js                every setting and every upstream URL
  app.js                   the API as one list of registrations
  db.js                    connection (embedded MongoDB in dev)
  models/                  ShareLink · VinDecode · ExchangeRate (schemas, indexes, TTLs)
  routes/                  health · config · rates · vin · share · geo
  services/                codes · rates · vin
src/
  types.ts                 Vehicle · Trip · Money · Line · Estimate · Msg
  state/                   calculator (7 values, everything else derives) · snapshot · share
  lib/calc/                ukraine · spain · eu (generic + Austria + Poland) · common
  lib/vehicle/             vin · decode · catalog · reference · identify
  lib/                     money · fx · api · shareLink · analytics · origins
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
- **Duty on cars from outside the EU**: 10%, TARIC heading 8703. Depends on the country of
  *manufacture*, not of purchase.
- **VIN**: position 9 is a checksum only on North American VINs; VW Group writes `ZZZ` in positions
  4–6 on non-US cars. That is how the market is detected, and the market decides whether EU type
  approval is needed.
- **NHTSA** decodes US-market VINs fully and European ones barely (make, year, plant). The gaps for
  Spain and Austria (WLTP CO₂, list price) come from `config/models.json`, a hand-checked list.
- **rdap.org returns 403**; Google Registry RDAP lies (says `google.app` is free). For domain checks
  use DNS NS records plus Verisign RDAP for `.com` and whois for `.io`.
- **Domains** (checked 9 Sep 2026): `mytno.io` free, as are `mytno.app`, `mytno.dev`, `mytno.co`,
  `mytno.xyz` — none is bought yet. Fallbacks if `.io` falls through: `mytno.app`, or **Dogana**
  (.dev .io .co free). The former name Tarifo is gone; `tarifo.com` was taken anyway.

## Decisions already made

- **State lives in the URL only**, never in localStorage: readable query before a result
  (`?from=LT&to=ES&vin=…&price=…`), and the address bar keeps that form even after a share code is
  minted. The short code (`/uk/f4uz`) appears only in the share field.
- **Share links** are generated automatically, half a second after the numbers settle; the field is
  click-to-copy. Identical calculations get one code (hash dedupe).
- **Without the API the site still shares.** `hasApi` is just `!!VITE_API_URL`; with no backend the
  link degrades to a self-contained `#s=<base64 snapshot>` instead of `/uk/f4uz`, VIN decoding calls
  NHTSA straight from the browser and the rates come from the bundled `config/fx.fallback.json`.
  That is what GitHub Pages serves today — Pages is static, the Fastify API is deployed nowhere.
  Set the repository variable `VITE_API_URL` once the API has a host and the short codes come back.
- **Design**: soft off-white canvas `#F4F4F6`, near-white surfaces, hairline borders, no shadows on
  cards, Inter only (no display serif), JetBrains Mono for the small labels, one warm orange accent
  `#E2662A` used sparingly. Everything explanatory hides behind a “?”.
- **The wheel mark** spins on hover, adds momentum on a second hover instead of restarting, and
  wobbles because it turns a few units off centre. Its SVG has `overflow: visible` so the wobble is
  not clipped — do not “fix” that by re-centring it.
- **Analytics** stays off until an id is set: Plausible (cookieless, no banner) or GA4 behind the
  consent bar. Both configured in `config/site.json` or via env.

## Where things stand

Everything above is built, tested and pushed. HEAD `7b88821`.

**Not done yet:**
1. ~~Nothing is pushed.~~ Live at **https://buhaenko.github.io/mytno/** — pushed to
   **`buhaenko/mytno`** (public), GitHub Pages built by the workflow. Note the two
   accounts: `gh` is logged in as **buhaenko** — the personal one, the only one this project goes
   to — while the machine's SSH key belongs to `SerhiiBuhaenko`. So the remote is HTTPS and git
   authenticates through the `gh` credential helper; do not switch it back to SSH.
2. **No domain bought.** Buy `mytno.io` on Cloudflare Registrar; then point Cloudflare Pages at it
   and set `SITE_URL=https://mytno.io` so canonical links, hreflang and the sitemap stop saying
   `github.io`.
3. ~~No contact email.~~ `feedback@mytno.io` — in `config/site.json`, shown in the footer above the
   copyright line with an invitation to report a wrong rate or a missing country, translated into
   all 23 languages (`footer.contact`). **The mailbox does not exist yet**: it needs the domain,
   then a Cloudflare Email Routing rule forwarding it to Serhii's inbox.
4. **More registration taxes worth computing**, each needs its official table: Netherlands BPM,
   France malus, Ireland VRT, Portugal ISV, Finland autovero.
5. **Cloudflare Pages: the repo is ready, the project is not connected yet.** Build `npm run build`,
   output `dist`, Node from `.node-version`, env `SITE_URL` (and `VITE_API_URL` once an API exists).
   `public/_headers` carries the caching and security headers; `VITE_BASE` stays unset — it exists
   only for GitHub Pages, which serves from `/mytno/`. Unknown paths fall back to the prerendered
   `404.html`, which boots the app, so `/uk/f4uz` resolves without a rewrite rule.
   Still to host: the API on Fly.io or Railway with MongoDB Atlas M0. Sentry and UptimeRobot
   before launch.

## History

- **09-08** Built from scratch in `~/work/vin-import-calc`: VIN decode, EPA catalogue (45 391 engine
  versions, 1984–2026), Ukraine and Spain rules, 23 languages, SEO prerender, share links.
- **09-09** Added the EU-27, Austrian NoVA, the legal footer, the Fastify + Mongoose backend and the
  shared `config/`. Rewrote the whole frontend for readability. Renamed from Vinta to Tarifo and
  moved to `~/homeprojects/tarifo`. Removed from the `~/work/CLAUDE.md` repository table.
  Renamed again to **mytno.io** — the brand is written in full, domain and all, everywhere it is
  visible (titles, og tags, footer in all 23 languages); identifiers and the Mongo database are
  plain `mytno`. Pushed to `buhaenko/mytno`, deployed to GitHub Pages, and the working directory
  moved to `~/homeprojects/mytno`. The deploy workflow was passing `VITE_SHARE_API`, a name nothing
  reads; it now passes `VITE_API_URL`, the one `src/lib/api.ts` actually looks at.
