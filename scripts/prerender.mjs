/**
 * After `vite build`: a real HTML file for every page in every language — the
 * calculator itself and one page per country a car can be registered in — each
 * with its own title, description, canonical URL and hreflang set, plus
 * sitemap.xml and robots.txt.
 *
 * A country page carries its text in the markup, not only in the app: the rates,
 * their official sources and the two questions people ask, built by the same
 * `countryBrief` the app renders, so the two can never say different things.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES } from '../src/i18n/locales.ts'
import { countryBrief, countryPath, routeBrief, routePath, sourcesFor } from '../src/lib/pages.ts'
import { note } from './note.ts'
import { averageOrder, spread } from '../src/lib/spread.ts'
import { carName, carPath, carSlug, carVehicle, rotation } from '../src/lib/cars.ts'
import { LEGAL_PATH, SOURCES_PATH } from '../src/lib/pages.ts'

// The worked examples are computed by the calculator itself, bundled for Node by the build,
// so a route page and the app can never quote different numbers for the same car.
const { estimate, fallbackRates, format, ORIGIN_GROUP } = await import('../.cache/calc.mjs')

const SITE = (process.env.SITE_URL ?? 'https://mytno.app').replace(/\/$/, '')
const DIST = 'dist'
const BRAND = 'mytno.app'
const shell = readFileSync(join(DIST, 'index.html'), 'utf8')

const config = (name) => JSON.parse(readFileSync(join('config', name), 'utf8'))
const countries = config('countries.json')
const ukraine = config('rules.ukraine.json')
const spain = config('rules.spain.json')
const DESTINATIONS = Object.keys(countries.destinations)
const { routes: ROUTES, example: EXAMPLE } = config('routes.json')

/**
 * How much the tool covers, counted rather than typed. Every sentence that quotes one of
 * these numbers takes it from here, so adding a destination rewrites the title, the
 * description, the home page and the route FAQ in all six languages at once.
 */
const COUNTS = {
  destinations: Object.keys(countries.destinations).length,
  origins: config('origins.json').countries.length,
  languages: LOCALES.length,
}
const fx = fallbackRates()

/** One route, priced once: the numbers are the same in every language, only the words differ. */
const priced = ROUTES.map((route) => {
  const origin = ORIGIN_GROUP[route.from] ?? 'OTHER'
  const market = origin === 'US' || origin === 'JP' || origin === 'KR' ? origin : 'EU'
  const car = { ...EXAMPLE, market, notes: [] }
  const trip = {
    origin, destination: route.to, price: EXAMPLE.priceEur, currency: 'EUR',
    hasOriginProof: true, residenceTransfer: false, region: EXAMPLE.region,
  }
  return { ...route, estimate: estimate(car, trip, fx) }
})

const SOURCE_CONFIG = {
  euDuty: countries.euDutySource,
  vat: countries.vatSource,
  regTaxNone: countries.regTaxNoneSource,
  precise: {
    UA: ukraine.refs.excise, UA_DUTY: ukraine.refs.duty, UA_VAT: ukraine.refs.vat,
    ES: spain.refs.iedmt, PL: countries.poland.source, AT: countries.austria.source,
  },
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const homePath = (locale) => (locale === 'en' ? '/' : `/${locale}/`)
const abs = (path) => `${SITE}${path}`

/** Every message of one language, read straight out of its file — no bundler needed. */
function messages(locale) {
  const file = `src/i18n/messages/${locale}.ts`
  const source = readFileSync(existsSync(file) ? file : 'src/i18n/messages/en.ts', 'utf8')
  const english = locale === 'en' ? {} : messages('en')
  const all = { ...english }
  for (const [, key, value] of source.matchAll(/^ {2}'([\w.\-]+)': '((?:[^'\\]|\\.)*)',$/gm)) {
    all[key] = value.replace(/\\'/g, "'").replace(/\\\\/g, '\\')
  }
  return all
}

/** The same `t` the app has: a template and whatever it needs filled in. */
/** The same interpolation the app does, decimal separator included — see src/i18n/index.ts. */
const translator = (all, locale = 'en') => (key, params) => {
  const show = (value) =>
    typeof value === 'number'
      ? value.toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: false })
      : String(value)
  return Object.entries(params ?? {}).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, show(value)), all[key] ?? key)
}

const countryName = (code, locale) => {
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code } catch { return code }
}

const alternates = (path) => [
  ...LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(path(l))}" />`),
  `<link rel="alternate" hreflang="x-default" href="${abs(path('en'))}" />`,
].join('\n    ')

/** One page: the shell with its head filled in, and whatever body a crawler should see. */
function render({ locale, path, title, description, head, body, image }) {
  return shell
    .replace('<html lang="en">', `<html lang="${locale}">`)
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escape(description)}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${escape(title)}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${escape(description)}" />`)
    .replace(/<meta property="og:image" content=".*?" \/>\n\s*/, '')
    .replace('<!--seo-->', [
      `<link rel="canonical" href="${abs(path)}" />`,
      `<meta property="og:url" content="${abs(path)}" />`,
      `<meta property="og:locale" content="${locale}" />`,
      `<meta property="og:site_name" content="${BRAND}" />`,
      `<meta property="og:image" content="${abs(image ?? `/og/${locale}.png`)}" />`,
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      `<meta name="twitter:image" content="${abs(image ?? `/og/${locale}.png`)}" />`,
      ...head,
    ].join('\n    '))
    .replace('<div id="app" class="pending"></div>', `<div id="app" class="pending">${body}</div>`)
}

/**
 * The long-form page. It carries no calculator, so it boots no app — which also means its
 * body may sit outside `#app`, where Vue cannot replace it. What each of the twenty-eight
 * charges is read out of the config the calculator uses, so the two cannot disagree.
 */
const REG_TAX_STATE = {
  computed: 'Computed here, from the official table',
  api: 'Asked of the register’s own API',
  regional: 'Depends on the region you live in',
  estimated: 'Official rates, on a value only that country can assign',
  none: 'Nothing at registration',
  national: 'Shown and linked, not counted',
}

function noteTable() {
  const rows = DESTINATIONS
    .map((code) => ({ code, name: countryName(code, 'en'), state: countries.destinations[code].regTax }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map(({ code, name, state }) =>
      `<tr><td><a href="${countryPath('/', 'en', code)}">${escape(name)}</a></td><td>${escape(REG_TAX_STATE[state] ?? state)}</td></tr>`)
  const tally = DESTINATIONS.reduce((acc, code) => {
    const state = countries.destinations[code].regTax
    acc[state] = (acc[state] ?? 0) + 1
    return acc
  }, {})
  const counted = (tally.computed ?? 0) + (tally.api ?? 0)
  const figures = [
    [counted, 'answer with a number'],
    [tally.estimated ?? 0, 'charge on their own valuation'],
    [tally.none ?? 0, 'charge nothing at all'],
    [tally.regional ?? 0, 'depend on the region'],
  ]
  return `<div class="note-count">${figures
    .map(([n, label]) => `<div><b>${n}</b><span>${escape(label)}</span></div>`).join('')}</div>
    <div class="note-table"><table>
      <thead><tr><th>Country</th><th>Registration tax</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`
}

function renderNote() {
  // The article quotes the coverage too, and must not be the one place left saying 28.
  const t2 = (text) => text.replaceAll('{destinations}', COUNTS.destinations)

  const body = [
    '<article class="note">',
    `<p class="note-eyebrow">${escape(BRAND)}</p>`,
    `<h1>${escape(t2(note.title))}</h1>`,
    `<div class="note-lead">${note.lead.map((p) => `<p>${t2(p)}</p>`).join('')}</div>`,
    '<hr class="note-rule" />',
    '<h2>Where the twenty-eight stand</h2>',
    noteTable(),
    ...note.sections.map((section) =>
      `<h2>${escape(section.heading)}</h2>${section.body.map((p) => `<p>${p}</p>`).join('')}`),
    '<a class="note-cta" href="/">Work out your own car →</a>',
    `<p class="note-foot">© ${new Date().getFullYear()} ${escape(BRAND)} · <a href="mailto:feedback@mytno.app">feedback@mytno.app</a></p>`,
    '</article>',
  ].join('')

  return render({ locale: 'en', path: note.slug, title: t2(note.title), description: t2(note.description), head: [], body: '' })
    // The app would only replace it, and there is nothing here for the app to do.
    .replace(/<script type="module"[^>]*><\/script>/, '')
    .replace('<div id="app" class="pending"></div>', body)
}


function write(path, html) {
  const directory = join(DIST, path)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'index.html'), html)
  if (path === '/') writeFileSync(join(DIST, 'index.html'), html)
}

const urls = []

/** The route index: the queries people actually type, and how a crawler reaches those pages. */
function routeLinks(locale, t) {
  const links = priced.map(({ from, to }) =>
    `<a href="${routePath('/', locale, from, to)}">${escape(countryName(from, locale))} → ${escape(countryName(to, locale))}</a>`)
  return `<nav>${escape(t('page.routes'))} ${links.join(' ')}</nav>`
}

/**
 * The ladder the home page opens with, as a plain table for whoever arrives without
 * JavaScript. Same function and same calculator as the component, so the crawler and the
 * reader cannot be shown different figures.
 */
// The first car of the rotation: what the reader sees in the first frame, so a crawler
// without JavaScript and a reader with it are looking at the same car.
const FIRST = rotation(config('models.json'))[0]
const FIRST_ENGINE = FIRST.engines[0]
const REFERENCE = carVehicle(FIRST, FIRST_ENGINE)
const REFERENCE_TRIP = {
  origin: 'EU', price: FIRST_ENGINE.listEur, currency: 'EUR',
  hasOriginProof: true, residenceTransfer: false, region: 'FL',
}
// The same fixed order the home page keeps while its cars change, so the table a crawler
// reads and the table a reader watches are in the same sequence as well as the same figures.
const ROTATION_LADDERS = rotation(config('models.json')).map((car) => spread(
  estimate, carVehicle(car, car.engines[0]),
  { origin: 'EU', price: car.engines[0].listEur, currency: 'EUR', hasOriginProof: true, residenceTransfer: false, region: 'FL' },
  DESTINATIONS, fx,
))
const SHOWN = 12
const ORDER = averageOrder(ROTATION_LADDERS).slice(0, SHOWN)
const FIRST_ALL = spread(estimate, REFERENCE, REFERENCE_TRIP, DESTINATIONS, fx)
const FIRST_LADDER = new Map(FIRST_ALL.map((r) => [r.code, r]))
// The fixed dozen, sorted for this car — the same two steps the component takes.
const LADDER = ORDER.map((code) => FIRST_LADDER.get(code) ?? { code, total: 0, share: 0 })
  .sort((a, b) => b.total - a.total)

function spreadTable(locale, t) {
  const car = `${carName(FIRST)} ${FIRST.years[1] ?? FIRST.years[0]}`
  const money = (n) => format(n, 'EUR', fx, locale)
  const rows = LADDER.map(({ code, total }) =>
    `<tr><td><a href="${countryPath('/', locale, code)}">${escape(countryName(code, locale))}</a></td>` +
    `<td>${escape(total < 1 ? t('home.spread.nothing') : money(total))}</td></tr>`)
  const sorted = [...FIRST_ALL].sort((a, b) => b.total - a.total)
  const dear = sorted[0]
  const cheap = sorted[sorted.length - 1]
  const note = t('home.spread.note', {
    low: `${countryName(cheap.code, locale)} — ${cheap.total < 1 ? t('home.spread.nothing') : money(cheap.total)}`,
    high: `${countryName(dear.code, locale)} — ${money(dear.total)}`,
    shown: LADDER.length,
    computed: FIRST_ALL.length,
    destinations: COUNTS.destinations,
  }).replace(/<\/?b>/g, '')
  return `<h2>${escape(t('home.spread.title', COUNTS))}</h2>` +
    `<p><strong>${escape(car)}</strong> ${escape(t('home.spread.car', { price: money(FIRST_ENGINE.listEur) }))}</p>` +
    `<table><tbody>${rows.join('')}</tbody></table>` +
    `<p>${escape(note)}</p>`
}

/**
 * A page per car model: the ladder for that exact car, which is what somebody searching for
 * their own model rather than for a country actually wants. Priced as it left the showroom —
 * its own list price, its own last year of production — so nothing is assumed for them.
 */
const CARS = config('models.json')
const CAR_LADDERS = new Map(CARS.map((car) => {
  const engine = car.engines[0]
  const vehicle = carVehicle(car, engine)
  const trip = {
    origin: 'EU', price: engine.listEur, currency: 'EUR',
    hasOriginProof: true, residenceTransfer: false, region: 'FL',
  }
  return [carSlug(car), { car, engine, vehicle, rows: spread(estimate, vehicle, trip, DESTINATIONS, fx) }]
}))

/**
 * Every rate on the site, country by country, taken from the calculator rather than typed
 * out beside it: for each destination the real lines are produced, and each one prints the
 * formula it used and the authority it read. A source that drifts from the code is worse
 * than none, and this way it cannot.
 */
function sourcesFor_(locale, t) {
  // A car brought in from outside the EU, so every line is exercised at its real rate: duty
  // applies, VAT is the country's own rather than the zero an intra-EU used car pays, and the
  // registration tax still computes because the car carries European approval.
  const shown = { ...REFERENCE, market: 'EU' }
  const trip = { ...REFERENCE_TRIP, origin: 'OTHER', hasOriginProof: false }
  const seen = new Set()
  const blocks = DESTINATIONS
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
    .map(({ code, name }) => {
      const result = estimate(shown, { ...trip, destination: code }, fx)
      const rows = result.lines
        .filter((line) => line.source || line.formula)
        .map((line) => {
          if (line.source) seen.add(line.source.url)
          const label = t(line.label.key, line.label.params)
          const formula = line.formula ? escape(line.formula) : (line.unknown ? escape(t('page.sources.asked')) : '—')
          const source = line.source
            ? `<a href="${escape(line.source.url)}" rel="noopener noreferrer" target="_blank">${escape(line.source.title)}</a>`
            : '—'
          return `<tr><td>${escape(label)}</td><td><code>${formula}</code></td><td>${source}</td></tr>`
        })
      return `<h3><a href="${countryPath('/', locale, code)}">${escape(name)}</a></h3>` +
        `<div class="src-table"><table>` +
        '<colgroup><col class="line"><col class="formula"><col class="source"></colgroup>' +
        '<thead><tr>' +
        `<th>${escape(t('page.sources.line'))}</th><th>${escape(t('page.sources.formula'))}</th><th>${escape(t('page.sources.source'))}</th>` +
        `</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    })
  return { blocks: blocks.join(''), count: seen.size }
}

/** The model index: how a crawler walks from any page to every car page. */
function carLinks(locale, t) {
  const links = CARS
    .map((car) => `<a href="${carPath('/', locale, carSlug(car))}">${escape(carName(car))}</a>`)
  return `<nav>${escape(t('page.cars'))} ${links.join(' ')}</nav>`
}

/** The country index, as plain links: how a crawler walks from any page to all of them. */
function countryLinks(locale, t) {
  const links = DESTINATIONS
    .map((code) => ({ code, label: countryName(code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
    .map(({ code, label }) => `<a href="${countryPath('/', locale, code)}">${escape(label)}</a>`)
  return `<nav>${escape(t('page.countries'))} ${links.join(' ')}</nav>`
}

for (const locale of LOCALES) {
  const t = translator(messages(locale), locale)

  // The calculator itself.
  const home = homePath(locale)
  urls.push({ loc: home, alt: homePath })
  write(home, render({
    locale, path: home,
    title: t('seo.title', COUNTS), description: t('seo.description', COUNTS),
    head: [alternates(homePath), `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebApplication', name: BRAND,
      alternateName: t('seo.title', COUNTS), description: t('seo.description', COUNTS), url: abs(home), inLanguage: locale,
      applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    })}</script>`],
    body: [
      `<h1>${escape(t('app.title'))}</h1>`,
      `<p>${escape(t('app.tagline'))}</p>`,
      `<p>${escape(t('page.home.about', COUNTS))}</p>`,
      spreadTable(locale, t),
      carLinks(locale, t),
      `<h2>${escape(t('page.routes'))}</h2>`,
      `<ul>${priced.map(({ from, to, estimate: e }) =>
        `<li><a href="${routePath('/', locale, from, to)}">${escape(countryName(from, locale))} → ${escape(countryName(to, locale))}</a> — ${escape(format(e.total.likely, 'EUR', fx, locale))}</li>`).join('')}</ul>`,
      countryLinks(locale, t),
    ].join(''),
  }))

  // One page per car model.
  for (const [slug, { car, engine, rows }] of CAR_LADDERS) {
    const path = (l) => carPath('/', l, slug)
    const here = path(locale)
    const name = carName(car)
    const money = (n) => format(n, 'EUR', fx, locale)
    const dearest = rows[0]
    const cheapest = rows[rows.length - 1]
    const low = cheapest.total < 1 ? t('home.spread.nothing') : money(cheapest.total)
    const vars = {
      car: name, engine: engine.label, countries: rows.length, destinations: COUNTS.destinations,
      price: money(engine.listEur), year: car.years[1] ?? car.years[0],
      low: `${countryName(cheapest.code, locale)} — ${low}`,
      high: `${countryName(dearest.code, locale)} — ${money(dearest.total)}`,
    }
    const title = t('page.car.h1', vars)
    urls.push({ loc: here, alt: path })
    write(here, render({
      locale, path: here, title: `${title} — ${BRAND}`, description: t('page.car.lead', vars),
      head: [alternates(path), `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [{ '@type': 'Question', name: t('page.car.faq.q', vars),
          acceptedAnswer: { '@type': 'Answer', text: t('page.car.faq.a', vars) } }],
      })}</script>`],
      body: [
        `<h1>${escape(title)}</h1>`,
        `<p>${escape(t('page.car.lead', vars))}</p>`,
        `<table><tbody>${rows.map(({ code, total }) =>
          `<tr><td><a href="${countryPath('/', locale, code)}">${escape(countryName(code, locale))}</a></td>` +
          `<td>${escape(total < 1 ? t('home.spread.nothing') : money(total))}</td></tr>`).join('')}</tbody></table>`,
        `<p>${escape(t('page.car.priceNote'))}</p>`,
        `<h2>${escape(t('page.car.engines'))}</h2>`,
        `<ul>${car.engines.map((e) =>
          `<li>${escape(e.label)}${e.co2 ? ` — CO₂ ${e.co2} g/km` : ''}${e.listEur ? `, ${escape(money(e.listEur))}` : ''}</li>`).join('')}</ul>`,
        `<h2>${escape(t('page.car.faq.q', vars))}</h2><p>${escape(t('page.car.faq.a', vars))}</p>`,
        carLinks(locale, t),
        countryLinks(locale, t),
      ].join(''),
    }))
  }

  // One page per country a car can be registered in.
  for (const code of DESTINATIONS) {
    const info = countries.destinations[code]
    const brief = countryBrief(countryName(code, locale), info, sourcesFor(code, info, SOURCE_CONFIG), t)
    const path = (l) => countryPath('/', l, code)
    const here = path(locale)
    urls.push({ loc: here, alt: path })

    const rows = brief.rows.map((row) =>
      `<dt>${escape(row.label)}</dt><dd>${escape(row.note)} <a href="${escape(row.source.url)}" rel="noopener noreferrer">${escape(row.source.title)}</a></dd>`).join('')
    const faq = brief.faq.map((item) => `<h2>${escape(item.q)}</h2><p>${escape(item.a)}</p>`).join('')

    write(here, render({
      locale, path: here,
      title: `${brief.h1} — ${BRAND}`,
      description: `${brief.h1}. ${brief.lead}`,
      head: [alternates(path), `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: locale,
        mainEntity: brief.faq.map((item) => ({
          '@type': 'Question', name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      })}</script>`],
      body: `<span class="hero-flag fi fi-${code.toLowerCase()}"></span><h1>${escape(brief.h1)}</h1><p>${escape(brief.lead)}</p><dl>${rows}</dl>${faq}${routeLinks(locale, t)}${countryLinks(locale, t)}`,
    }))
  }

  // One page per route: the question as people ask it, answered with a worked example.
  for (const { from, to, estimate: e } of priced) {
    const path = (l) => routePath('/', l, from, to)
    const here = path(locale)
    urls.push({ loc: here, alt: path })

    const car = `${EXAMPLE.make} ${EXAMPLE.model} ${EXAMPLE.year}`
    const price = format(EXAMPLE.priceEur, 'EUR', fx, locale)
    const total = format(e.total.likely, 'EUR', fx, locale)
    const brief = routeBrief(countryName(from, locale), countryName(to, locale), { car, price, total }, t, COUNTS)

    const lines = e.lines.filter((l) => !l.unknown && l.amount.likely > 0)
      .map((l) => `<dt>${escape(t(l.label.key, l.label.params))}</dt><dd>${escape(format(l.amount.likely, 'EUR', fx, locale))}</dd>`).join('')
    const faq = brief.faq.map((item) => `<h2>${escape(item.q)}</h2><p>${escape(item.a)}</p>`).join('')

    write(here, render({
      locale, path: here,
      title: `${brief.h1} — ${BRAND}`,
      description: `${brief.h1}. ${brief.lead}`,
      // The route card carries the number, and needs no translation to do it.
      image: `/og/route/${from.toLowerCase()}-${to.toLowerCase()}.png`,
      head: [alternates(path), `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: locale,
        mainEntity: brief.faq.map((item) => ({
          '@type': 'Question', name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      })}</script>`],
      body: [
        `<span class="hero-flag fi fi-${from.toLowerCase()}"></span><span class="hero-flag fi fi-${to.toLowerCase()}"></span>`,
        `<h1>${escape(brief.h1)}</h1><p>${escape(brief.lead)}</p>`,
        `<h2>${escape(brief.exampleTitle)}</h2><dl>${lines}<dt>${escape(brief.totalLabel)}</dt><dd>${escape(total)}</dd></dl>`,
        `<p>${escape(brief.exampleNote)}</p>`,
        faq,
        `<nav><a href="${countryPath('/', locale, to)}">${escape(countryName(to, locale))}</a> <a href="${countryPath('/', locale, from)}">${escape(countryName(from, locale))}</a></nav>`,
        routeLinks(locale, t),
      ].join(''),
    }))
  }
}

// The legal notice, as a page. It used to be four paragraphs inside a footer tooltip, which
// is a fine place to hide something and a poor place to publish it.
for (const locale of LOCALES) {
  const t = translator(messages(locale), locale)
  const path = (l) => `${homePath(l)}${LEGAL_PATH}`
  const here = path(locale)
  const examples = [countries.euDutySource, countries.vatSource, ukraine.refs.excise]
  urls.push({ loc: here, alt: path })
  write(here, render({
    locale, path: here,
    title: `${t('page.legal.h1')} — ${BRAND}`,
    description: t('footer.disclaimer').replace('{brand}', BRAND),
    head: [alternates(path)],
    body: [
      '<article class="sources">',
      `<p class="sources-brand"><a href="${homePath(locale)}">${escape(BRAND)}</a></p>`,
      `<h1>${escape(t('page.legal.h1'))}</h1>`,
      `<p class="sources-lead">${escape(t('footer.disclaimer').replace('{brand}', BRAND))}</p>`,
      ...['footer.help.rights', 'footer.data', 'footer.privacy', 'footer.liability']
        .map((key) => `<p class="legal-para">${escape(t(key))}</p>`),
      `<h3>${escape(t('page.sources'))}</h3>`,
      `<ul class="legal-list">${examples.map((source) =>
        `<li><a href="${escape(source.url)}" rel="noopener noreferrer" target="_blank">${escape(source.title)}</a></li>`).join('')}` +
        `<li><a href="${homePath(locale)}${SOURCES_PATH}">${escape(t('page.sources.h1'))}</a></li></ul>`,
      '</article>',
    ].join(''),
  }).replace(/<script type="module"[^>]*><\/script>/, '')
    .replace('<div id="app" class="pending">', '<div class="page">'))
}

// Where every rate comes from, one page per language.
for (const locale of LOCALES) {
  const t = translator(messages(locale), locale)
  const path = (l) => `${homePath(l)}${SOURCES_PATH}`
  const here = path(locale)
  const { blocks } = sourcesFor_(locale, t)
  const dataRows = [
    [t('page.sources.cars'), 'NHTSA vPIC · EPA fueleconomy.gov', 'https://vpic.nhtsa.dot.gov/api/'],
    [t('page.sources.rates'), 'ECB · NBP · Norges Bank · NBU', 'https://data-api.ecb.europa.eu/'],
  ]
  urls.push({ loc: here, alt: path })
  write(here, render({
    locale, path: here,
    title: `${t('page.sources.h1')} — ${BRAND}`,
    description: t('page.sources.lead'),
    head: [alternates(path)],
    body: [
      '<article class="sources">',
      `<p class="sources-brand"><a href="${homePath(locale)}">${escape(BRAND)}</a></p>`,
      `<h1>${escape(t('page.sources.h1'))}</h1>`,
      `<p class="sources-lead">${escape(t('page.sources.lead'))}</p>`,
      blocks,
      `<h3>${escape(t('page.sources.cars'))} · ${escape(t('page.sources.rates'))}</h3>`,
      `<div class="src-table"><table><colgroup><col class="line"><col class="formula"><col class="source"></colgroup><tbody>${dataRows.map(([a, b, u]) =>
        `<tr><td>${escape(a)}</td><td><code>—</code></td><td><a href="${u}" rel="noopener noreferrer" target="_blank">${escape(b)}</a></td></tr>`).join('')}</tbody></table></div>`,
      countryLinks(locale, t),
      '</article>',
    ].join(''),
  }).replace(/<script type="module"[^>]*><\/script>/, '')
    .replace('<div id="app" class="pending">', '<div class="page">')
    .replace(/<\/div>\s*<\/body>/, '</div></body>'))
}

// The long-form page, once, in English: it is the article the research earned.
write(note.slug, renderNote())
urls.push({ loc: note.slug, alt: null })

const today = new Date().toISOString().slice(0, 10)
writeFileSync(join(DIST, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...urls.map(({ loc, alt }) => {
    const links = alt ? LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(alt(l))}"/>`).join('') : ''
    return `  <url><loc>${abs(loc)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq>${links}</url>`
  }),
  '</urlset>',
  '',
].join('\n'))
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
writeFileSync(join(DIST, '404.html'), shell.replace('<!--seo-->', '<meta name="robots" content="noindex" />'))

console.log(`prerendered ${urls.length} pages (${LOCALES.length} languages × ${DESTINATIONS.length + 1} countries + ${priced.length} routes) → ${SITE}`)
