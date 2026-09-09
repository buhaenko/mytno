export const health = (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) })
