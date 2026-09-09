// Runs after `vite build`: writes dist/<lang>/index.html with localized meta, hreflang, JSON-LD, plus sitemap.xml and robots.txt.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SITE = (process.env.SITE_URL ?? 'https://serhiibuhaenko.github.io/vin-import-calc').replace(/\/$/, '')
const LOCALES = ['uk', 'en', 'es', 'de', 'pl', 'fr', 'it', 'pt', 'nl', 'ro', 'cs', 'sk', 'hu', 'bg', 'hr', 'sl', 'lt', 'lv', 'et', 'fi', 'sv', 'da', 'el']
const dist = 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')

import { existsSync } from 'node:fs'
async function messages(l) {
  const file = `src/i18n/messages/${l}.ts`
  const src = readFileSync(existsSync(file) ? file : 'src/i18n/messages/en.ts', 'utf8')
  const get = (k) => (src.match(new RegExp(`'${k.replace('.', '\\.')}': '((?:[^'\\\\]|\\\\.)*)'`)) ?? [])[1] ?? ''
  return { title: get('seo.title'), description: get('seo.description'), h1: get('app.title'), tagline: get('app.tagline') }
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const urlFor = (l) => (l === 'en' ? `${SITE}/` : `${SITE}/${l}/`)
const hreflang = LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l)}" />`).join('\n    ') + `\n    <link rel="alternate" hreflang="x-default" href="${urlFor('en')}" />`

for (const l of LOCALES) {
  const m = await messages(l)
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: m.title, description: m.description, url: urlFor(l), inLanguage: l, applicationCategory: 'FinanceApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } })
  let out = html
    .replace('<html lang="en">', `<html lang="${l}">`)
    .replace(/<title>.*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${esc(m.description)}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${esc(m.title)}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${esc(m.description)}" />`)
    .replace('<!--seo-->', `<meta property="og:site_name" content="Vinta" />\n    <link rel="canonical" href="${urlFor(l)}" />\n    <meta property="og:url" content="${urlFor(l)}" />\n    <meta property="og:locale" content="${l}" />\n    ${hreflang}\n    <script type="application/ld+json">${ld}</script>`)
    .replace('<div id="app"></div>', `<div id="app"><noscript><h1>${esc(m.h1)}</h1><p>${esc(m.tagline)}</p></noscript></div>`)
  if (l === 'en') writeFileSync(join(dist, 'index.html'), out)
  mkdirSync(join(dist, l), { recursive: true })
  writeFileSync(join(dist, l, 'index.html'), out)
}
const today = new Date().toISOString().slice(0, 10)
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${LOCALES.map((l) => `  <url><loc>${urlFor(l)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq>${LOCALES.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${urlFor(x)}"/>`).join('')}</url>`).join('\n')}\n</urlset>\n`)
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
writeFileSync(join(dist, '404.html'), html.replace('<!--seo-->', '<meta name="robots" content="noindex" />'))
console.log('prerendered', LOCALES.length, 'locales →', SITE)
