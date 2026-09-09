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
| Netherlands | duty, VAT 21%, **BPM**: the 2026 CO₂ table for the same car new, less the official depreciation table for its age, plus the diesel surcharge. The purchase price never enters it |
| Portugal | duty, VAT 23%, **ISV**: the cylinder component plus the environmental one, each of them rate × value − deduction, less the table-D reduction for years of use, never below €100 |
| Czechia | duty, VAT 21%, the one-off **emission fee**: 3 000 CZK for EURO 2, 5 000 for EURO 1, 10 000 for no standard, nothing from EURO 3 up — read off the model year |
| Lithuania | duty, VAT 21%, the **registration tax** off Regitra's table: nothing to 130 g/km, then a step every 10 g, the diesel column exactly twice the petrol one |
| Slovakia | duty, VAT 23%, the **registration fee**: the rate for the engine power (€33 to €1 000) times the ecological coefficient of its emission standard, which the year of first registration gives |
| France | duty, VAT 20%, the **malus CO₂** on the scale of the year the car was first registered anywhere — nothing at all before 2015 — less the décote for its age. Only European type approvals; the weight malus and the carte grise are named but not counted |
| Slovenia | duty, VAT 22%, **DMV**: an amount for CO₂ and fuel, one for engine power and one for the EURO standard, added and then reduced for the age of the car |
| Hungary | duty, VAT 27%, **regisztrációs adó**: a multiplier from engine power on 47 000 Ft, less the monthly reduction for age — for cars first registered from 2021 and for hybrids of any age |
| Italy | duty, VAT 22%, **IPT**: €150.81 up to 53 kW, then €3.5119/kW, shown as a range because the province may add up to 30% |
| Estonia | duty, VAT 24%, and the **registration fee the register itself works out** — the browser asks Transpordiamet's own API and puts its answer in the total |
| Belgium | duty, VAT 21%, and the tax of the **region the owner lives in**: Flanders' BIV and Wallonia's TMC are computed once the region is chosen, Brussels is shown and not counted |
| DE BG RO LU SE LV CY | duty + national VAT; registration tax a real €0, every one checked against its own authority on 9 Sep 2026 |
| the other 7 EU countries | duty 10% + national VAT; the registration tax is shown as “not in total” with a link to the authority that levies it, because its base is a value we cannot reproduce or a table nobody publishes. Ireland and Croatia at least name what *is* known — the CO₂ band, the emissions half — instead of shrugging |

Market estimates, labelled as such in their “?”: certificate of conformity, homologación, ITV,
DGT fee, plates, mandatory lighting conversion.

## Facts worth not re-deriving

- **EU VAT rates**: Taxes in Europe Database, as of 1 July 2025; Romania went to 21% on 1 Aug 2025.
- **Czechia charges an emission fee once**, on the first registration of an import: 3 000 CZK for
  EURO 2, 5 000 for EURO 1, 10 000 for no standard, nothing from EURO 3 up (Act 542/2020 Sb., SFŽP).
  It is computed now, from the model year — EURO 3 from January 2001, EURO 2 from 1997, EURO 1 from
  1993 — and converted from koruna at the ECB rate of the day.
- **Dutch BPM is a CO₂ tax, not a price tax** (checked 9 Sep 2026). The 2026 brackets are a fixed
  amount plus a per-gram rate — €687 + €2/g to 77 g/km, then 841 + 82, 2 727 + 181, 9 786 + 297 and
  14 538 + 594 above 155 — plus €114.83 for every diesel gram above 69. A used import is then written
  down by the *forfaitaire afschrijvingstabel*, by months since first registration: 33% at 9 months,
  62% at 5½ years, 81% at 9½ and 0.19% a month after. It is due on the first Dutch plate whatever the
  origin, EU included. Where a car has no certified CO₂ the Belastingdienst applies a punitive forfait
  (550 g/km for petrol), which is real but so far above any actual car that we ask for the CO₂ instead.
- **Portuguese ISV is fully derivable from what we already know** (Código do ISV, arts. 7.º, 8.º and
  11.º, consolidated text on diariodarepublica.pt, checked 9 Sep 2026): a cylinder component and an
  environmental one, each `rate × value − deduction`, a negative environmental result netted against
  the cylinder one, the table-D reduction for years of use — 10% in the first year to 80% after ten —
  and never less than €100. Pure electric cars are outside the tax; a plug-in below 50 g/km pays a
  quarter, if it also runs 50 km on the battery, which the car's data does not tell us, so the note
  says so. A diesel pays €500 more unless its particulates are below 0.001 g/km — that figure is on
  the certificate of conformity and in none of our inputs, so it is a note, not a number.
- **The three inherited zeros are real** (checked 9 Sep 2026). Luxembourg charges a €50 chancellery
  fee and an annual road tax, no registration tax; Sweden's malus is an elevated *annual* fordonsskatt
  for three years, never a lump sum; Latvia's CO₂ levy is the annual ekspluatācijas nodoklis, merely
  pro-rated for the remaining months when the car is registered. All three now cite their own
  authority rather than the generic Your Europe page.
- **Where the base is the country's own valuation, we cannot compute and should not pretend.**
  Denmark values the car on the Danish market, Finland at its Finnish retail value, Ireland at
  Revenue's OMSP (and adds a NOx levy in mg/km), Malta at Transport Malta's own registration value.
  None of that is derivable from a foreign purchase price, and in those countries the domestic price
  already contains the tax, so a price proxy would not be a rough answer but a wrong one.
- **Italy has no registration tax in the CO₂ sense.** The IPT is a provincial transcription fee on
  engine power: €150.81 up to 53 kW, €3.5119/kW above it (D.M. 435/1998), which each province may
  raise by up to 30% — a genuine range, which is exactly what a line's min…max is for.
- **Cyprus charges nothing, and the sources that say otherwise are wrong.** The excise duty on cars
  was not replaced by an age-and-euro-standard surcharge, as the secondary sources kept repeating —
  law 39(I)/2019 rewrote the Fourth Schedule of the Excise Duties Law 91(I)/2004 to read **«Ατελώς»**,
  duty-free, for headings 8703.21 to 8703.90, and the consolidated text with amendments through 2026
  still says so. Cyprus's own transport site is literally “under construction”, so the text comes from
  cylaw.org, the public repository of the Gazette. It is `none` now, not a link.
- **Greece taxes engine size and the emission Directive, not CO₂.** An AADE circular says so in as
  many words: CO₂ “δεν καθορίζεται” — does not determine — the registration tax for ordinary cars.
  Art. 121 of law 2960/2001 sets four coefficient tables by cylinder capacity, chosen by which
  Directive the car meets, from 7–88% for Euro 5/6-era approvals up to 41–385% for pre-Euro; hybrids
  meeting 94/12 or later and electric cars are exempt under §5. The used-car base is the price of the
  equivalent new car less a monthly depreciation table by body type, which AADE does publish
  (2% at one month, 19% at a year, 61% at five, 95% flat past sixteen). It is still not computable —
  the base is a Greek new-car price — and about twenty-five amending laws sit unconsolidated between
  us and the current coefficients.
- **Belgium's Brussels grid is primary now, its Flemish coefficients are not.** The Brussels tax is
  in the Code des taxes assimilées aux impôts sur les revenus, art. 98: €61.50 to 70 kW, then 123,
  495, 867, 1 239, 2 478 and €4 957 above 155 kW, the higher of the CV and kW grids winning, less
  90/80/70…10% by year of age and a flat €61.50 from fifteen years; CO₂ plays no part, and LPG takes
  €298 off. Those are the statutory amounts, indexed annually since 2024 — the indexed 2026 figures
  are not on any page that would load. Art. 101 settles the product question: the tax follows the
  address on the registration certificate, so the region is the owner's domicile, and no Belgian
  answer can be given until the visitor says which of the three it is.
- **Belgium is computed for two of its three regions**, and the region is now asked for: a set of
  chips beside the price, because art. 101 ties the tax to the address on the registration
  certificate. The same 2017 Audi is €276 in Flanders and €2 427 in Wallonia — which is the whole
  argument for asking rather than picking one. Flanders came from the Vlaamse Codex's own open-data
  API: two formulas side by side, `((CO₂·f·q)/246)⁶·4500 + c) · LC` for cars first registered after
  2020 and the additive `x` form for older ones, with q = 1.07 in 2021 rising 0.035 a year (1.245 in
  2026) and x = 4.5 g for every year since 2013, a euro-standard amount c from €20.61 to €2 863.15,
  an age correction from 100% to 10%, bounds of €41.99 and €10 497.70, €61.50 flat for an electric
  car registered from 2026 and €41.99 for anything past thirty. Brussels stays out of the total: its
  grid is statutory but indexed every July since 2024, and the indexed table is published nowhere.
- **Belgium is three taxes, and Wallonia's is the one we have.** Wallonia publishes the whole table
  (valid 1 Jul 2026 – 30 Jun 2027): a base by power — €64.01 to 70 kW, 128.02, 515.20, 902.37,
  1 289.55, 2 579.10 and €5 159.25 above 155 kW — times CO₂/136 (WLTP), times full mass/1 838, times
  a fuel coefficient (0.01–0.26 electric, 0.80 hybrid, 1.00 the rest), with an age degression to a
  flat €61.50 after fifteen years and bounds of €50 and €9 000. Flanders uses its own formula with a
  yearly technology coefficient (1.245 for 2026) and Brussels charges on fiscal horsepower and age
  with no CO₂ at all — neither published a numeric table our fetch could read. Nothing can be computed
  until the visitor says which region, which nobody asks them today.
- **Hungary's base stopped being displacement.** From 1 March 2025 the regisztrációs adó is engine
  power times an environmental class: a multiplier from 1 to 216 on 45 000 Ft, less a monthly
  depreciation (3% in the first two months, 45% at three years, 90% past 169 months). Cars first
  registered after 2020, and hybrids, sit in the first column, which we could read straight off the
  year; older ones need the Hungarian class from decree 6/1990 KöHÉM, which is neither CO₂ nor Euro.
- **Croatia's two tables are in euro and confirmed** (Uredba NN 156/2022): a price component — 0% to
  €26 544, then 3%, 5%, 7%, 9%, 11%, 13%, 15%, 16% and 17% above €79 634, each with its own base
  amount — plus a CO₂ component from 95 g/km, €5.97 a gram for petrol against €13.94 for diesel, and
  a plug-in relief equal in percent to its electric range in km. Missing: the depreciation table of
  the Pravilnik, of which only points are known (86% at four months, 70.28% at eighteen, 59.32% at
  thirty).
- **Slovenia stopped being a percentage of price in 2021.** ZDMV-1 adds three separate tables — CO₂
  with fuel, engine power, and Euro standard — and multiplies by an age reduction from 100% in the
  first year to 40% after ten; electric cars pay too, on power alone. Every figure we have comes from
  the 2020 bill, because pisrs.si and uradni-list.si serve empty shells; the enacted text still has to
  be read. It also needs kW, the Euro standard and the seat count.
- **Cyprus abolished its excise duty on 1 Jan 2019** (law 39(I)/2019) and replaced it with a one-off
  surcharge by euro standard and fuel. No Cypriot government site would answer, so the table itself is
  still unknown; the CO₂-based charge that is easy to find is the *annual* road tax, a different thing.
- **France: the décote is found, the old barèmes are not.** The 2026 WLTP barème (art. L.421-62):
  nothing below 108 g/km, €75 at 109, €2 205 at 140, €8 770 at 160, €45 990 at 180, flat €80 000
  above 191. The décote is art. **L.421-7-2** — 3% at 1–3 months, 16% at 13–18, 28% at 25–36, 38% at
  49–60, 64% at 109–120, 82% at 145–156, 100% from 181 — and it applies to the weight malus too
  (L.421-73). A car first registered before 1 Jan 2015 owes nothing (L.421-60), and an import already
  registered elsewhere in the EU is liable like any other (L.421-33/36; the only exemption at that
  slot, L.421-65, is for wheelchair-accessible vehicles). What still blocks it: **the barème of the
  car's own first-registration year applies, wherever that happened** (L.421-62, L.421-72), and the
  article carries barèmes only from 2020 — 2015 to 2019 sit in the old Code général des impôts. A car
  with no European type approval falls to the fiscal-horsepower barème (L.421-64), one approved before
  WLTP to the NEDC barème (L.421-63); neither has been collected. The malus au poids (€10/kg from
  1 500 kg to €30 from 2 000, less 100 kg for a hybrid and 200 for a plug-in, capped at 15% of mass)
  needs a kerb mass we do not have, and L.421-74 caps the two together at the top of the CO₂ barème.
- **Estonia has charged a registration fee since 1 Jan 2025** — a base part plus CO₂ and mass parts,
  times an age coefficient, collected by Transpordiamet at first registration and separate from the
  annual motor vehicle tax the tax office bills. The config called it €0 until 9 Sep 2026, which was
  simply wrong. But **its numbers are not on Estonia's own site**: transpordiamet.ee and emta.ee
  publish the fee's field names, not its rates; the CO₂ bands and the mass part live in the law on
  riigiteataja.ee, which did not render. The fee is real and one-off — a base part, a CO₂ part and a
  until those figures come from the law itself it stays linked, not computed. Its own calculation API
  also wants a kerb mass, which we do not have.
- **Lithuania is a lookup, not a formula** (checked 9 Sep 2026). Regitra publishes the whole table:
  nothing up to 130 g/km, then €20.23 for petrol at 131–140 g/km rising to €364.23 above 300, with
  diesel exactly double and the gas column about nine tenths of petrol. The columns are fuel *groups* —
  the diesel one also covers diesel+gas and diesel+electric — and the amounts are indexed yearly, so
  the table wants re-reading each January.
- **The Slovak fee ignores CO₂ entirely** (checked 9 Sep 2026, zákon 145/1995 Z. z., položka 65).
  Since 1 July 2023 it is the rate for engine power — €33 up to 80 kW, then 60, 90, 120, 200, 300,
  500, 700, 900 and €1 000 above 210 kW — times an ecological coefficient the emission standard sets:
  0.40 for Euro 6d, 0.45, 0.50, 0.60, 0.70, 0.80 and 1.00 for Euro 1, plus 0.20 for plug-ins and
  hydrogen and 0.10 for a car past forty. The age of the car stopped mattering in 2023. We take the
  later side of each boundary year so the fee is never understated, and convert `powerHp` at 0.7355.
- **Registration taxes were the weak spot.** Thirteen are now computed from official tables
  (UA ES PL AT CZ FR HU IT LT NL PT SK SI), six are a zero each country's own authority confirms, and
  nine are a link. Estonia proved the risk: a country's answer can change under a config that nobody
  revisits.
- **Slovenia's bill and Slovenia's law are different documents.** Everything first collected from the
  2020 ZDMV-1 bill turned out to be wrong — the CO₂ bands, the power bands, the EURO amounts and the
  age table all differ in the enacted text (Uradni list RS 200/2020, cross-checked against the FURS
  guidance of 5 Sep 2025). The real thing: CO₂ nothing to 50 g/km, then €0.4 a gram petrol against
  €0.5 diesel, €0.7/€0.8 from 100, €5/€6 from 140, €30/€36 from 190, €50/€60 above 230, each band
  carrying the previous band's total as its base; power €1 a kW to 20 kW, then €2, €5 from 40 and €7
  above 60, the same way; a flat amount for the EURO standard from €500/€1 000 for EURO 0–3 down to
  €10/€15 for better than 6d; the sum then reduced to 91% in the first year and 33% past ten. A zero
  emission car pays €0 flat. Only the NEDC→WLTP factors (1.22 petrol, 1.20 diesel) matched the bill.
- **Hungary's first column is a date, not a condition of sale.** The law's own words are “14-nél jobb
  és 2020. december 31-ét követően helyezték első alkalommal forgalomba belföldön vagy külföldön”, or
  a hybrid of any age — so for an import the column can be read off the year of first registration
  *wherever it happened*. The base amount is valorised each January: 45 000 Ft became **47 000 Ft for
  2026** (NAV, under Rega tv. § 8 (5)), while the multiplier table itself did not change. Before 2021
  a car needs the Hungarian environmental class of decree 6/1990 KöHÉM, which is neither CO₂ nor a
  EURO norm, so those stay out of the total.
- **France is computed now, and the scale is the car's own.** Art. L.421-62 carries a WLTP table for
  every year from 2020 (first taxed gram 138 in 2020, 108 in 2026; cap €20 000 then €30 000, €40 000,
  €50 000, €60 000, €70 000, €80 000 — and 2027 is already published), art. L.421-63 the NEDC tables,
  2015 and 2016 sharing one table of bands and 2017–2019 running gram by gram. The article prints
  “Inférieures à N | 0” and then “N | 50”, so N is taxed, not exempt — the one thing to get wrong.
  A car with no European type approval is charged on fiscal horsepower (L.421-64) instead, which no
  ordinary vehicle data carries, so those stay out of the total rather than being charged on CO₂.
- **Estonia is asked, not reproduced — and it has a state of its own, `api`.** The line is filled in
  from the authority's reply the way the exchange rates are: a watcher fires when the car or the
  destination changes, only the newest question counts, and a slow or failed answer leaves the line
  out of the total rather than guessing. It is the only country needing a gross mass, so that field
  appears for Estonia alone.
- **Estonia has an official calculator API, and it answers a browser.**
  `https://apimsm.transpordiamet.ee/v2/msm/regTasu/by-technical-parameters` takes `category`,
  `co2wltp`, `technPermMaxLadenMass`, `initialRegDate`, `seats` and `regFeeCalcDate` as a plain GET,
  needs no key, and replies `access-control-allow-origin: *` with the preflight passing. A 2017 petrol
  car with 168 g/km and 2 000 kg comes back as `{"totalPrice":528.30,"co2Price":378.30,"massPrice":
  0.00,"basePrice":150.00,"ageCoef":0.26}`. That beats reproducing the law — which is just as well,
  since riigiteataja.ee serves an Angular shell and the ministry's draft figures do not match what the
  API returns. It needs a gross mass, which nothing in our data carries and which every European
  registration certificate prints.
- **Where the amount cannot be honest, the note can still be useful.** Ireland's line names the band
  the car falls into — “CO₂ 168 g/km puts it in the 30% band, or €600, whichever is greater” — and
  says the percentage is of a value Revenue assigns, not of the invoice. Croatia's names the emissions
  half in euro and says the other half runs off a Croatian list price nobody publishes. Both stay out
  of the total. A number that is wrong is worse than no number, but a blank where a fact was available
  is a waste of a line.
- **Croatia cannot be computed at all, and now we know why.** The customs administration's own FAQ:
  “Neovisno gdje je rabljeno motorno vozilo kupljeno i koliko je za njega plaćeno, Carinska uprava će
  u svim slučajevima utvrđivati tržišnu vrijednost rabljenog motornog vozila na hrvatskom tržištu.”
  The value-based half of the tax runs off the Croatian list price of the equivalent *new* car, which
  manufacturers file with customs and nobody publishes; the buyer's invoice is expressly excluded.
  The rest of it is in hand — the price brackets and the CO₂ tables in euro, the full depreciation
  schedule of the Pravilnik (96% at one month, 65% at two years, 40.06% at five, 19.32% at fifteen),
  the plug-in relief equal in percent to the electric range in km, the €265.45 flat charge past thirty
  years, and 401 g/km assumed when no CO₂ is proven — so if a source for Croatian list prices ever
  turns up, only that piece is missing.
- **The CO₂ field follows the tax, not Spain.** It was shown only for Spain and Austria, so a reader
  choosing the Netherlands, Portugal or Lithuania had nowhere to type the one number their tax needs.
  It now appears for all five, its “?” no longer cites a Spanish law at readers of the other four, and
  Slovakia gets a power field of its own for the same reason.
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
5. **Finish the registration taxes** — all 28 have been checked once (9 Sep 2026) and seven are
   computed; what is left, and in what order, has a section of its own below.
6. **Before real traffic**: Sentry, UptimeRobot, and a redirect rule so `www.mytno.app` goes to the
   apex instead of serving a second copy (the canonical tag covers it for now).

## The next job: verify every registration tax

The calculation is only as honest as this table. All 28 were gone through on 9 Sep 2026 — every
country now either computes its tax, or declares a zero its own authority confirms, or links to the
authority that levies it. Whoever carries it further: **one country at a time, an official source or
nothing.** A page that reproduces a law is not the law.

**Where each of the 28 stands today** (every one of them looked at on 9 Sep 2026)

| State | Countries | What it means |
| --- | --- | --- |
| `computed` | UA ES PL AT CZ NL PT | the full formula, from an official table, cited in the breakdown |
| `none` | DE BG RO LU SE LV | a real €0, each confirmed against the authority that would charge it |
| `national` | BE HR CY DK EE FI FR GR HU IE IT LT MT SK SI | a tax exists but we do not compute it: the line is shown, marked “not in total”, linked to the authority that levies it |

**How to do one country**

1. Find the levying authority's own page — tax office, customs, vehicle registry, or the law itself.
   Not a blog, not a dealer, not an aggregator. Ukrainian, Polish and Austrian entries in
   `config/` are the pattern to copy.
2. Decide which of the three states it really is. A country that charges anything at registration is
   never `none`, even when the usual car pays zero — Czechia charges only EURO 2 and below, and
   saying “no tax” was still wrong.
3. Put it in `config/countries.json` → `destinations.<CC>`: keep `regTax`, add `regTaxSource`
   (`{title, url}`) when the authority is not the customs service, and add the rates in a
   `config/rules.<country>.json` of their own if the formula is worth computing.
4. Compute it when the inputs are already on screen — price, year, CO₂, fuel, engine size. The Czech
   emission fee is derivable from the model year alone (EURO 3 from January 2001), so it belongs in
   the computed column, not the linked one. `src/lib/calc/eu.ts` → `registrationTax()` is where a
   new formula goes; Austria's NoVA in the same function shows the shape.
5. Say where the number came from: every new line needs a `source` and every new sentence a key in
   all 23 message files. The country pages pick both up automatically.
6. Check it in the browser before pushing (see **Working rules**), and record the date and the source
   in this file under **Facts worth not re-deriving**.

**What is left.** Fourteen countries answer with a number — thirteen computed here and Estonia asked
of its register — six are a confirmed zero, and the eight that remain are each blocked by something
specific, written down above.

1. **Brussels** is the only piece of Belgium left, and it needs one number: the index that art. 98bis
   has applied every July since 2024. Its grid is already in the config.
2. **Greece and Malta** are blocked on their own governments — the Greek coefficients sit behind
   twenty-five unconsolidated amendments, and Malta's base is a value Transport Malta assigns.
3. **Croatia, Denmark, Finland, Ireland, Greece, Malta** are settled as *not computable*, for one
   reason each says out loud: the base is that country's own valuation of the car, and the invoice is
   not it. Ireland and Croatia already say what they can; Denmark and Finland could do the same —
   Denmark's CO₂ surcharge (294 / 587 / 1 115 kr a gram) and Finland's per-gram rate table are both
   published, and naming the band is more use than a shrug.

**The remaining inputs, and what each would unlock.** The *month* of first registration would sharpen
the Dutch, French and Hungarian tables, which are monthly while we still count from the middle of a
model year. A gross mass unlocks Estonia and the French weight malus. A region unlocks Belgium. The
Hungarian environmental class would extend Hungary back past 2021, and an Italian province would turn
that range into a number — but both are things a visitor is unlikely to know, and a range is the
honest answer where the law itself leaves one.

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
  - **Went through the registration tax of all 28 destinations**, one country at a time, against the
    authority that levies it. Three moved into the computed column — the Dutch BPM, the Portuguese
    ISV and the Czech emission fee — the three unverified zeros were confirmed, and every country
    that stays “not in total” now links to its own tax office instead of to its customs service.
  - **Then read the remaining fifteen a second time, deeper**, and added Lithuania and Slovakia, which
    turned out to need nothing we did not already have. Fixed a real hole while doing it: the CO₂
    field only appeared for Spain and Austria, so three of the computed countries had no way to
    receive the number their tax is made of.
  - **A third pass went after the tables themselves** and added France, Slovenia, Hungary and Italy —
    thirteen of the twenty-eight now compute. Croatia turned out to be impossible rather than merely
    missing a table, Estonia turned out to have an API, and Slovenia turned out to have a law that
    disagrees with its own bill in almost every number.
  - **A fourth pass finished it**: Estonia is asked of its own register, Belgium asks the visitor
    which region they live in and computes two of the three, Cyprus turned out to charge nothing at
    all, and Ireland and Croatia say what is known where the amount cannot be. Twenty-one of the
    twenty-eight destinations now end in a number.
