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
import { countryBrief, countryPath, sourcesFor } from '../src/lib/pages.ts'

const SITE = (process.env.SITE_URL ?? 'https://mytno.app').replace(/\/$/, '')
const DIST = 'dist'
const BRAND = 'mytno.app'
const shell = readFileSync(join(DIST, 'index.html'), 'utf8')

const config = (name) => JSON.parse(readFileSync(join('config', name), 'utf8'))
const countries = config('countries.json')
const ukraine = config('rules.ukraine.json')
const spain = config('rules.spain.json')
const DESTINATIONS = Object.keys(countries.destinations)

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
function render({ locale, path, title, description, head, body }) {
  return shell
    .replace('<html lang="en">', `<html lang="${locale}">`)
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escape(description)}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${escape(title)}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${escape(description)}" />`)
    .replace('<!--seo-->', [
      `<link rel="canonical" href="${abs(path)}" />`,
      `<meta property="og:url" content="${abs(path)}" />`,
      `<meta property="og:locale" content="${locale}" />`,
      `<meta property="og:site_name" content="${BRAND}" />`,
      ...head,
    ].join('\n    '))
    .replace('<div id="app"></div>', `<div id="app">${body}</div>`)
}

function write(path, html) {
  const directory = join(DIST, path)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'index.html'), html)
  if (path === '/') writeFileSync(join(DIST, 'index.html'), html)
}

const urls = []

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
    body: `<noscript><h1>${escape(t('app.title'))}</h1><p>${escape(t('app.tagline'))}</p></noscript>${countryLinks(locale, t)}`,
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
      body: `<h1>${escape(brief.h1)}</h1><p>${escape(brief.lead)}</p><dl>${rows}</dl>${faq}${countryLinks(locale, t)}`,
    }))
  }
}

const today = new Date().toISOString().slice(0, 10)
writeFileSync(join(DIST, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...urls.map(({ loc, alt }) => {
    const links = LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(alt(l))}"/>`).join('')
    return `  <url><loc>${abs(loc)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq>${links}</url>`
  }),
  '</urlset>',
  '',
].join('\n'))
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
writeFileSync(join(DIST, '404.html'), shell.replace('<!--seo-->', '<meta name="robots" content="noindex" />'))

console.log(`prerendered ${urls.length} pages (${LOCALES.length} languages × ${DESTINATIONS.length + 1}) → ${SITE}`)
