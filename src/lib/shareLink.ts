import { api, hasApi } from './api'
import type { Locale } from '../i18n'

/**
 * A share link is `domain/<locale>/<code>` and the calculation lives in the database.
 * Without a backend we fall back to a self-contained `#s=…` link so nothing is lost.
 */
const BASE = import.meta.env.BASE_URL
const CODE = /^[a-z0-9]{4,10}$/
const LOCALE = /^[a-z]{2}$/

const encode = (value: unknown) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function decode<T>(text: string): T | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/'))))) as T } catch { return null }
}

/** The path after the base can hold a locale and a share code, in either order. */
export function pathParts(): { locale?: string; code?: string } {
  const parts: { locale?: string; code?: string } = {}
  for (const segment of location.pathname.slice(BASE.length).split('/').filter(Boolean)) {
    if (!parts.locale && LOCALE.test(segment)) parts.locale = segment
    else if (!parts.code && CODE.test(segment)) parts.code = segment
  }
  return parts
}

export const appUrl = (locale: Locale, path = '', query = '') =>
  `${location.origin}${BASE}${locale === 'en' ? '' : `${locale}/`}${path}${query}`

export async function createShareUrl(state: unknown, locale: Locale): Promise<string> {
  if (hasApi) {
    try {
      const { code } = await api<{ code: string }>('/api/share', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state),
      })
      return appUrl(locale, code)
    } catch { /* fall back to a self-contained link */ }
  }
  return `${appUrl(locale)}#s=${encode(state)}`
}

/** Reads whichever form the visitor arrived with: a code in the path, or the state in the hash. */
export async function readShared<T>(): Promise<T | null> {
  const code = pathParts().code ?? location.hash.match(/^#c=([a-z0-9]{4,10})$/)?.[1]
  if (code) {
    if (!hasApi) return null
    try { return await api<T>(`/api/share/${code}`) } catch { return null }
  }
  const inline = location.hash.match(/^#s=([A-Za-z0-9_-]+=*)$/)
  return inline ? decode<T>(inline[1]!) : null
}

export async function geoCountry(): Promise<string | null> {
  if (!hasApi) return null
  try { return (await api<{ country: string | null }>('/api/geo', {}, 3000)).country } catch { return null }
}
