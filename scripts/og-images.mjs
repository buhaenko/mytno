/**
 * The share card, one per language. A link with no image is a wall of text in every
 * chat it lands in, so each page points at a 1200×630 PNG carrying the same question
 * the site opens with, the wheel mark, and the two numbers that say what it covers.
 *
 * Run: `npm run og` — it writes the HTML here and renders it with headless Chrome.
 * The result lives in `public/og/` and is committed, so the build needs no browser.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES } from '../src/i18n/locales.ts'

const CHROME = process.env.CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = 'public/og'
const WORK = join(process.env.TMPDIR ?? '/tmp', 'mytno-og')

const { routes: ROUTES, example: EXAMPLE } = JSON.parse(readFileSync('config/routes.json', 'utf8'))
const { estimate, fallbackRates, format, ORIGIN_GROUP } = await import('../.cache/calc.mjs')
const fx = fallbackRates()

/** 🇺🇸 from US: the two letters of a country code are the two letters of its flag. */
const flag = (code) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))

const countries = JSON.parse(readFileSync('config/countries.json', 'utf8'))
const origins = JSON.parse(readFileSync('config/origins.json', 'utf8'))
const DESTINATIONS = Object.keys(countries.destinations).length
const ORIGINS = (origins.countries ?? origins).length ?? Object.keys(origins).length

/** Every message of one language, read straight out of its file — the same way prerender does. */
function messages(locale) {
  const source = readFileSync(`src/i18n/messages/${locale}.ts`, 'utf8')
  const english = locale === 'en' ? {} : messages('en')
  const found = {}
  for (const [, key, value] of source.matchAll(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)'/gm)) {
    found[key] = value.replace(/\\'/g, "'").replace(/\\\\/g, '\\')
  }
  return { ...english, ...found }
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

function card({ title, tagline, footer }) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column; justify-content: space-between;
    padding: 68px 72px; background: #F4F4F6; color: #1C1C20;
    font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  }
  .mark { display: flex; align-items: center; gap: 14px; }
  .mark svg { width: 42px; height: 42px; }
  .mark span { font-family: 'JetBrains Mono', monospace; font-size: 21px; letter-spacing: .01em; font-weight: 500; }
  h1 { font-size: 68px; line-height: 1.06; font-weight: 600; letter-spacing: -.025em; max-width: 17ch; text-wrap: balance; }
  p { margin-top: 22px; font-size: 26px; line-height: 1.4; color: #55565D; max-width: 40ch; }
  .facts { display: flex; align-items: center; gap: 0; border-top: 1px solid #D3D4D9; padding-top: 22px; }
  .fact { padding-right: 44px; margin-right: 44px; border-right: 1px solid #D3D4D9; }
  .fact:last-child { border-right: 0; }
  .fact b { display: block; font-size: 30px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .fact span { font-family: 'JetBrains Mono', monospace; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #7A7B83; }
</style></head>
<body>
  <div class="mark">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#1C1C20"/>
      <circle cx="32" cy="32" r="21" fill="#FBFBFC"/>
      <g stroke="#1C1C20" stroke-width="3.4">
        <path d="M32 11v42M14 21l36 22M14 43l36-22"/>
      </g>
      <circle cx="32" cy="32" r="7" fill="#E2662A"/>
    </svg>
    <span>mytno.app</span>
  </div>
  <div>
    <h1>${escape(title)}</h1>
    <p>${escape(tagline)}</p>
  </div>
  <div class="facts">
    ${footer.map((f) => `<div class="fact"><b>${escape(f.value)}</b><span>${escape(f.label)}</span></div>`).join('\n    ')}
  </div>
</body></html>`
}

/**
 * A route card says the one thing that earns the click: the number. Flags and a price
 * need no translation, so thirty cards serve all twenty-three languages.
 */
function routeCard({ from, to, total, car, price }) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column; justify-content: space-between;
    padding: 68px 72px; background: #F4F4F6; color: #1C1C20;
    font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  }
  .mark { font-family: 'JetBrains Mono', monospace; font-size: 21px; letter-spacing: .01em; color: #55565D; }
  .route { font-size: 82px; line-height: 1; letter-spacing: .04em; }
  .route span { color: #7A7B83; font-size: 54px; vertical-align: 14px; padding: 0 18px; }
  .total { font-size: 108px; font-weight: 600; letter-spacing: -.03em; font-variant-numeric: tabular-nums; margin-top: 18px; }
  .car { margin-top: 14px; font-size: 26px; color: #55565D; }
  .foot { display: flex; align-items: center; gap: 14px; border-top: 1px solid #D3D4D9; padding-top: 20px; }
  .foot b { width: 10px; height: 10px; border-radius: 50%; background: #E2662A; }
  .foot span { font-family: 'JetBrains Mono', monospace; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #7A7B83; }
</style></head>
<body>
  <div class="mark">mytno.app</div>
  <div>
    <div class="route">${flag(from)}<span>→</span>${flag(to)}</div>
    <div class="total">${escape(total)}</div>
    <div class="car">${escape(car)} · ${escape(price)}</div>
  </div>
  <div class="foot"><b></b><span>${escape(from)} → ${escape(to)} · mytno.app</span></div>
</body></html>`
}

rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
mkdirSync(OUT, { recursive: true })

for (const locale of LOCALES) {
  const t = messages(locale)
  const html = card({
    title: t['app.title'],
    tagline: t['app.tagline'],
    // The three labels the site already has in every language: from, to, language.
    footer: [
      { value: String(ORIGINS), label: t['app.from'] },
      { value: String(DESTINATIONS), label: t['app.to'] },
      { value: String(LOCALES.length), label: t['app.lang'] },
    ],
  })
  const page = join(WORK, `${locale}.html`)
  writeFileSync(page, html)
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000',
    '--window-size=1200,630', `--screenshot=${join(OUT, `${locale}.png`)}`, `file://${page}`,
  ], { stdio: 'ignore' })
}

mkdirSync(join(OUT, 'route'), { recursive: true })
for (const route of ROUTES) {
  const origin = ORIGIN_GROUP[route.from] ?? 'OTHER'
  const market = origin === 'US' || origin === 'JP' || origin === 'KR' ? origin : 'EU'
  const result = estimate({ ...EXAMPLE, market, notes: [] }, {
    origin, destination: route.to, price: EXAMPLE.priceEur, currency: 'EUR',
    hasOriginProof: true, residenceTransfer: false, region: EXAMPLE.region,
  }, fx)
  const page = join(WORK, `route-${route.from}-${route.to}.html`)
  writeFileSync(page, routeCard({
    from: route.from, to: route.to,
    total: format(result.total.likely, 'EUR', fx, 'en'),
    car: `${EXAMPLE.make} ${EXAMPLE.model} ${EXAMPLE.year}`,
    price: format(EXAMPLE.priceEur, 'EUR', fx, 'en'),
  }))
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000',
    '--window-size=1200,630', `--screenshot=${join(OUT, 'route', `${route.from.toLowerCase()}-${route.to.toLowerCase()}.png`)}`,
    `file://${page}`,
  ], { stdio: 'ignore' })
}

console.log(`share cards → ${OUT}/ (${LOCALES.length} languages + ${ROUTES.length} routes, 1200×630)`)
