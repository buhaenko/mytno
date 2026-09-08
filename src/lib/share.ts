/**
 * Share-посилання. Якщо задано VITE_SHARE_API (Cloudflare Worker + KV) — короткий код #c=ab3k9.
 * Інакше — компактний самодостатній стан у #s= (без сервера). Обидва формати читаються.
 */
const API = (import.meta.env.VITE_SHARE_API as string | undefined)?.replace(/\/$/, '')

export function encodeState(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeState<T>(s: string): T | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))) as T } catch { return null }
}

export async function createShareUrl(state: unknown): Promise<string> {
  const base = `${location.origin}${location.pathname}`
  if (API) {
    try {
      const res = await fetch(`${API}/s`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) })
      if (res.ok) { const { code } = (await res.json()) as { code: string }; return `${base}#c=${code}` }
    } catch { /* fallback нижче */ }
  }
  return `${base}#s=${encodeState(state)}`
}

export async function readShared<T>(): Promise<T | null> {
  const h = location.hash
  const c = h.match(/^#c=([a-z0-9]{5,10})$/)
  if (c && API) {
    try { const res = await fetch(`${API}/s/${c[1]}`); if (res.ok) return (await res.json()) as T } catch { /* noop */ }
    return null
  }
  const s = h.match(/^#s=([A-Za-z0-9_-]+=*)$/)
  return s ? decodeState<T>(s[1]!) : null
}

export async function geoCountry(): Promise<string | null> {
  if (!API) return null
  try { const res = await fetch(`${API}/geo`); if (res.ok) return ((await res.json()) as { country: string | null }).country } catch { /* noop */ }
  return null
}
