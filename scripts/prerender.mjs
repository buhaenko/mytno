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
const translator = (all) => (key, params) =>
  Object.entries(params ?? {}).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), all[key] ?? key)

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
  const body = [
    '<article class="note">',
    `<p class="note-eyebrow">${escape(BRAND)}</p>`,
    `<h1>${escape(note.title)}</h1>`,
    `<div class="note-lead">${note.lead.map((p) => `<p>${p}</p>`).join('')}</div>`,
    '<hr class="note-rule" />',
    '<h2>Where the twenty-eight stand</h2>',
    noteTable(),
    ...note.sections.map((section) =>
      `<h2>${escape(section.heading)}</h2>${section.body.map((p) => `<p>${p}</p>`).join('')}`),
    '<a class="note-cta" href="/">Work out your own car →</a>',
    `<p class="note-foot">© ${new Date().getFullYear()} ${escape(BRAND)} · <a href="mailto:feedback@mytno.app">feedback@mytno.app</a></p>`,
    '</article>',
  ].join('')

  return render({ locale: 'en', path: note.slug, title: note.title, description: note.description, head: [], body: '' })
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

/** The country index, as plain links: how a crawler walks from any page to all of them. */
function countryLinks(locale, t) {
  const links = DESTINATIONS
    .map((code) => ({ code, label: countryName(code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
    .map(({ code, label }) => `<a href="${countryPath('/', locale, code)}">${escape(label)}</a>`)
  return `<nav>${escape(t('page.countries'))} ${links.join(' ')}</nav>`
}

for (const locale of LOCALES) {
  const t = translator(messages(locale))

  // The calculator itself.
  const home = homePath(locale)
  urls.push({ loc: home, alt: homePath })
  write(home, render({
    locale, path: home,
    title: t('seo.title'), description: t('seo.description'),
    head: [alternates(homePath), `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebApplication', name: BRAND,
      alternateName: t('seo.title'), description: t('seo.description'), url: abs(home), inLanguage: locale,
      applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    })}</script>`],
    body: [
      `<h1>${escape(t('app.title'))}</h1>`,
      `<p>${escape(t('app.tagline'))}</p>`,
      `<p>${escape(t('page.home.about'))}</p>`,
      `<h2>${escape(t('page.routes'))}</h2>`,
      `<ul>${priced.map(({ from, to, estimate: e }) =>
        `<li><a href="${routePath('/', locale, from, to)}">${escape(countryName(from, locale))} → ${escape(countryName(to, locale))}</a> — ${escape(format(e.total.likely, 'EUR', fx, locale))}</li>`).join('')}</ul>`,
      countryLinks(locale, t),
    ].join(''),
  }))

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
    const brief = routeBrief(countryName(from, locale), countryName(to, locale), { car, price, total }, t)

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
