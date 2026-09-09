// A small in-memory limit per IP. Enough for a public calculator behind a CDN.
import { env } from '../config.js'

const hits = new Map()

export function rateLimit(req, res, next) {
  const ip = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = hits.get(ip) ?? { count: 0, since: now }
  if (now - entry.since > 60_000) { entry.count = 0; entry.since = now }
  entry.count++
  hits.set(ip, entry)
  if (hits.size > 10_000) for (const [k, v] of hits) if (now - v.since > 120_000) hits.delete(k)
  if (entry.count > env.rateLimitPerMinute) return res.status(429).json({ error: 'too many requests' })
  next()
}
