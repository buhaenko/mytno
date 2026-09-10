/**
 * The wheel mark as raster icons, rendered from public/favicon.svg by Chrome at each size
 * rather than scaled down from one big one, so the five spokes land on whole pixels.
 *
 * Why it exists: Google showed a generic globe next to mytno.app in search results. It
 * fetches /favicon.ico from the root by name — ours was a 404 — and it wants a square
 * that is a multiple of 48 pixels. The only raster we shipped was 32. So this writes the
 * sizes Google asks for and packs the .ico that it, and a dozen feed readers, still want.
 *
 * The PNGs are committed, so a build needs no browser. Re-run `npm run icons` when the
 * mark changes.
 */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9331
const PUBLIC = join(process.cwd(), 'public')
/** The .ico carries the small three; the PNGs are what a search engine reads. */
const ICO_SIZES = [16, 32, 48]
const PNG_FILES = { 32: 'favicon-32.png', 48: 'favicon-48.png', 96: 'favicon-96.png', 144: 'favicon-144.png' }

const svg = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8')
const page = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0}html,body{background:transparent}svg{display:block}</style>
${svg.replace('<svg ', '<svg id="mark" ')}`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu',
  '--hide-scrollbars', '--no-first-run', `--user-data-dir=/tmp/mytno-icons`,
  '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

let target
for (let i = 0; i < 40 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') }
  catch { await sleep(250) }
}
if (!target) { chrome.kill(); throw new Error('Chrome did not start') }

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => socket.addEventListener('open', r))
let id = 0
const pending = new Map()
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id
  pending.set(n, res)
  socket.send(JSON.stringify({ id: n, method, params }))
})

await send('Emulation.setDeviceMetricsOverride', { width: 600, height: 600, deviceScaleFactor: 1, mobile: false })
// The mark's corners are cut, so whatever is behind them has to stay transparent.
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
await send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(page)}` })
await sleep(700)

/** One size: set the mark to it, then photograph exactly that square. */
async function draw(size) {
  await send('Runtime.evaluate', { expression:
    `{ const m = document.getElementById('mark'); m.setAttribute('width', ${size}); m.setAttribute('height', ${size}) }` })
  await sleep(60)
  const shot = await send('Page.captureScreenshot', {
    format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
  })
  return Buffer.from(shot.result.data, 'base64')
}

const drawn = new Map()
for (const size of [...new Set([...ICO_SIZES, ...Object.keys(PNG_FILES).map(Number)])]) drawn.set(size, await draw(size))

for (const [size, name] of Object.entries(PNG_FILES)) {
  writeFileSync(join(PUBLIC, name), drawn.get(Number(size)))
  console.log(`${name} — ${size}×${size}`)
}

/**
 * An .ico is a six-byte header, a sixteen-byte directory entry per image and then the
 * images themselves. PNG payloads are legal inside one and every browser reads them.
 */
const entries = ICO_SIZES.map((size) => ({ size, png: drawn.get(size) }))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(entries.length, 4)
let offset = 6 + entries.length * 16
const directory = Buffer.concat(entries.map(({ size, png }) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(size === 256 ? 0 : size, 0)
  e.writeUInt8(size === 256 ? 0 : size, 1)
  e.writeUInt8(0, 2)          // colours in palette: none, it is a PNG
  e.writeUInt8(0, 3)          // reserved
  e.writeUInt16LE(1, 4)       // colour planes
  e.writeUInt16LE(32, 6)      // bits per pixel
  e.writeUInt32LE(png.length, 8)
  e.writeUInt32LE(offset, 12)
  offset += png.length
  return e
}))
const ico = Buffer.concat([header, directory, ...entries.map((e) => e.png)])
writeFileSync(join(PUBLIC, 'favicon.ico'), ico)
console.log(`favicon.ico — ${ICO_SIZES.join(', ')} (${ico.length} bytes)`)

socket.close()
chrome.kill()
