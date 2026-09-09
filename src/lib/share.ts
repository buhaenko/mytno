/**
 * Share links: `domain/<code>` (4–10 chars) via the share backend (VITE_SHARE_API: server/ or worker/).
 * Without a backend we fall back to a self-contained `#s=…` link. Both formats (and the legacy `#c=`) are readable.
 */
import { api, hasApi } from './api'

const BASE = import.meta.env.BASE_URL
const CODE = /^[a-z0-9]{4,10}$/
const LOCALE = /^[a-z]{2}$/

export const hasShareApi = hasApi

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
  if (hasApi) {
    try {
      const { code } = await api<{ code: string }>('/api/share', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state),
      })
      return appUrl(locale, code)
    } catch { /* fall back to a self-contained link */ }
  }
  return `${appUrl(locale)}#s=${encodeState(state)}`
}

export async function readShared<T>(): Promise<T | null> {
  const { code } = pathParts()
  const legacy = location.hash.match(/^#c=([a-z0-9]{4,10})$/)?.[1]
  const c = code ?? legacy
  if (c && hasApi) {
    try { return await api<T>(`/api/share/${c}`) } catch { return null }
  }
  const s = location.hash.match(/^#s=([A-Za-z0-9_-]+=*)$/)
  return s ? decodeState<T>(s[1]!) : null
}

export async function geoCountry(): Promise<string | null> {
  if (!hasApi) return null
  try { return (await api<{ country: string | null }>('/api/geo', {}, 3000)).country } catch { return null }
}
