// Share-link backend: short codes stored in SQLite (node:sqlite, no dependencies).
// Endpoints: POST /s {json} -> {code}; GET /s/:code -> json; GET /geo -> {country}.
// Run: node server/index.mjs   (PORT=8787, SHARE_DB=server/data/links.sqlite, ORIGIN=*)
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const PORT = Number(process.env.PORT ?? 8787)
const DB_PATH = process.env.SHARE_DB ?? 'server/data/links.sqlite'
const ORIGIN = process.env.ORIGIN ?? '*'
const MAX_BODY = 4096
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no 0/o, 1/l/i

mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new DatabaseSync(DB_PATH)
db.exec(`CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  ip TEXT
)`)
const insert = db.prepare('INSERT INTO links (code, body, created_at, ip) VALUES (?, ?, ?, ?)')
const select = db.prepare('SELECT body FROM links WHERE code = ?')
const hit = db.prepare('UPDATE links SET hits = hits + 1 WHERE code = ?')
const exists = db.prepare('SELECT 1 FROM links WHERE code = ?')
const byBody = db.prepare('SELECT code FROM links WHERE body = ? LIMIT 1')

const rate = new Map() // ip -> { count, ts }
function limited(ip) {
  const now = Date.now()
  const r = rate.get(ip) ?? { count: 0, ts: now }
  if (now - r.ts > 60_000) { r.count = 0; r.ts = now }
  r.count++
  rate.set(ip, r)
  return r.count > 60
}
function newCode(len) {
  const buf = randomBytes(len)
  return [...buf].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}
const headers = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'content-type': 'application/json' }
const send = (res, status, data, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(JSON.stringify(data)) }

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const ip = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.socket.remoteAddress ?? ''
  if (req.method === 'OPTIONS') return send(res, 204, null)
  if (url.pathname === '/geo') return send(res, 200, { country: req.headers['cf-ipcountry'] ?? req.headers['x-country'] ?? null })
  if (url.pathname === '/health') return send(res, 200, { ok: true })
  if (req.method === 'POST' && url.pathname === '/s') {
    if (limited(ip)) return send(res, 429, { error: 'rate limited' })
    let body = ''
    for await (const chunk of req) { body += chunk; if (body.length > MAX_BODY) return send(res, 413, { error: 'too large' }) }
    let parsed
    try { parsed = JSON.parse(body) } catch { return send(res, 400, { error: 'bad json' }) }
    const canonical = JSON.stringify(parsed)
    const dup = byBody.get(canonical)
    if (dup) return send(res, 200, { code: dup.code })
    for (let len = 4; len <= 10; len++) {
      const code = newCode(len)
      if (exists.get(code)) continue
      insert.run(code, canonical, Date.now(), ip)
      return send(res, 201, { code })
    }
    return send(res, 500, { error: 'retry' })
  }
  const m = url.pathname.match(/^\/s\/([a-z0-9]{4,10})$/)
  if (req.method === 'GET' && m) {
    const row = select.get(m[1])
    if (!row) return send(res, 404, { error: 'not found' })
    hit.run(m[1])
    res.writeHead(200, { ...headers, 'cache-control': 'public, max-age=86400' })
    return res.end(row.body)
  }
  send(res, 404, { error: 'not found' })
}).listen(PORT, () => console.log(`share server on http://localhost:${PORT} (db: ${DB_PATH})`))
