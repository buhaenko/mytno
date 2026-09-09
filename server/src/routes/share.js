import { env } from '../config.js'
import { readShare, saveShare } from '../services/codes.js'

const CODE = /^[a-z0-9]{4,10}$/

export const shareRoutes = {
  async create(req, res) {
    const body = JSON.stringify(req.body ?? null)
    if (body === 'null') return res.status(400).json({ error: 'empty body' })
    if (Buffer.byteLength(body) > env.shareMaxBytes) return res.status(413).json({ error: 'too large' })
    res.status(201).json({ code: await saveShare(body, req.ip) })
  },
  async read(req, res) {
    if (!CODE.test(req.params.code)) return res.status(400).json({ error: 'bad code' })
    const body = await readShare(req.params.code)
    if (!body) return res.status(404).json({ error: 'not found' })
    res.set('cache-control', 'public, max-age=86400').type('application/json').send(body)
  },
}
