/**
 * After `vite build`: one HTML file per language with its own title, description,
 * canonical URL and hreflang set, plus sitemap.xml and robots.txt.
 * Search engines get a real page per language; the app still boots the same way.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES } from '../src/i18n/locales.ts'

const SITE = (process.env.SITE_URL ?? 'https://mytno.io').replace(/\/$/, '')
const DIST = 'dist'
const shell = readFileSync(join(DIST, 'index.html'), 'utf8')

const urlFor = (locale) => (locale === 'en' ? `${SITE}/` : `${SITE}/${locale}/`)
const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Read the few strings we need straight out of the locale file, without a bundler. */
function seoStrings(locale) {
  const file = `src/i18n/messages/${locale}.ts`
  const source = readFileSync(existsSync(file) ? file : 'src/i18n/messages/en.ts', 'utf8')
  const read = (key) => source.match(new RegExp(`'${key.replace('.', '\\.')}': '((?:[^'\\\\]|\\\\.)*)'`))?.[1] ?? ''
  return { title: read('seo.title'), description: read('seo.description'), h1: read('app.title'), tagline: read('app.tagline') }
}

const hreflang = [
  ...LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l)}" />`),
  `<link rel="alternate" hreflang="x-default" href="${urlFor('en')}" />`,
].join('\n    ')

function pageFor(locale) {
  const { title, description, h1, tagline } = seoStrings(locale)
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'mytno.io',
    alternateName: title,
    description,
    url: urlFor(locale),
    inLanguage: locale,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  })

  return shell
    .replace('<html lang="en">', `<html lang="${locale}">`)
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escape(description)}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${escape(title)}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${escape(description)}" />`)
    .replace('<!--seo-->', [
      `<link rel="canonical" href="${urlFor(locale)}" />`,
      `<meta property="og:url" content="${urlFor(locale)}" />`,
      `<meta property="og:locale" content="${locale}" />`,
      `<meta property="og:site_name" content="mytno.io" />`,
      hreflang,
      `<script type="application/ld+json">${jsonLd}</script>`,
    ].join('\n    '))
    .replace('<div id="app"></div>', `<div id="app"><noscript><h1>${escape(h1)}</h1><p>${escape(tagline)}</p></noscript></div>`)
}

for (const locale of LOCALES) {
  const html = pageFor(locale)
  if (locale === 'en') writeFileSync(join(DIST, 'index.html'), html)
  mkdirSync(join(DIST, locale), { recursive: true })
  writeFileSync(join(DIST, locale, 'index.html'), html)
}

const today = new Date().toISOString().slice(0, 10)
const alternates = LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l)}"/>`).join('')
writeFileSync(join(DIST, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...LOCALES.map((l) => `  <url><loc>${urlFor(l)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq>${alternates}</url>`),
  '</urlset>',
  '',
].join('\n'))
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
writeFileSync(join(DIST, '404.html'), shell.replace('<!--seo-->', '<meta name="robots" content="noindex" />'))

console.log(`prerendered ${LOCALES.length} locales → ${SITE}`)
