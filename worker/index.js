// Cloudflare Worker: короткі коди для share-посилань (KV) + країна за IP для вибору мови.
// Деплой: npx wrangler deploy (у папці worker/). Потрібен KV namespace LINKS (див. wrangler.toml).
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // без 0/o, 1/l/i
function code(n = 5) {
  const buf = new Uint8Array(n); crypto.getRandomValues(buf)
  return [...buf].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' } })

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (url.pathname === '/geo') return json({ country: req.headers.get('cf-ipcountry') || null })
    if (req.method === 'POST' && url.pathname === '/s') {
      const text = await req.text()
      if (text.length > 4096) return json({ error: 'too large' }, 413)
      try { JSON.parse(text) } catch { return json({ error: 'bad json' }, 400) }
      for (let i = 0; i < 5; i++) {
        const c = code(4 + i)
        if (await env.LINKS.get(c)) continue
        await env.LINKS.put(c, text, { expirationTtl: 60 * 60 * 24 * 365 })
        return json({ code: c })
      }
      return json({ error: 'retry' }, 500)
    }
    const m = url.pathname.match(/^\/s\/([a-z0-9]{4,10})$/)
    if (req.method === 'GET' && m) {
      const v = await env.LINKS.get(m[1])
      return v ? new Response(v, { headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' } }) : json({ error: 'not found' }, 404)
    }
    return json({ error: 'not found' }, 404)
  },
}
