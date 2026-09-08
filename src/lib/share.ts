/**
 * Share links: `domain/<code>` (4–10 chars) via the share backend (VITE_SHARE_API: server/ or worker/).
 * Without a backend we fall back to a self-contained `#s=…` link. Both formats (and the legacy `#c=`) are readable.
 */
const API = (import.meta.env.VITE_SHARE_API as string | undefined)?.replace(/\/$/, '')
const BASE = import.meta.env.BASE_URL
const CODE = /^[a-z0-9]{4,10}$/
const LOCALE = /^[a-z]{2}$/

export const hasShareApi = !!API

export function encodeState(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeState<T>(s: string): T | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))) as T } catch { return null }
}

/** Path segments after BASE_URL: [locale?, code?] */
export function pathParts(): { locale?: string; code?: string } {
  const segs = location.pathname.slice(BASE.length).split('/').filter(Boolean)
  const out: { locale?: string; code?: string } = {}
  for (const s of segs) {
    if (!out.locale && LOCALE.test(s)) out.locale = s
    else if (!out.code && CODE.test(s)) out.code = s
  }
  return out
}

export function appUrl(locale: string, path = '', query = ''): string {
  return `${location.origin}${BASE}${locale === 'en' ? '' : locale + '/'}${path}${query}`
}

export async function createShareUrl(state: unknown, locale: string): Promise<string> {
  if (API) {
    try {
      const res = await fetch(`${API}/s`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) })
      if (res.ok) { const { code } = (await res.json()) as { code: string }; return appUrl(locale, code) }
    } catch { /* fallback */ }
  }
  return `${appUrl(locale)}#s=${encodeState(state)}`
}

export async function readShared<T>(): Promise<T | null> {
  const { code } = pathParts()
  const legacy = location.hash.match(/^#c=([a-z0-9]{4,10})$/)?.[1]
  const c = code ?? legacy
  if (c && API) {
    try { const res = await fetch(`${API}/s/${c}`); if (res.ok) return (await res.json()) as T } catch { /* noop */ }
    return null
  }
  const s = location.hash.match(/^#s=([A-Za-z0-9_-]+=*)$/)
  return s ? decodeState<T>(s[1]!) : null
}

export async function geoCountry(): Promise<string | null> {
  if (!API) return null
  try { const res = await fetch(`${API}/geo`); if (res.ok) return ((await res.json()) as { country: string | null }).country } catch { /* noop */ }
  return null
}
