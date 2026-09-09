/**
 * The Tarifo API (server/). Set VITE_API_URL to use it.
 * Without it the app still works: it calls the public services directly and
 * falls back to the bundled config, so it can be hosted as a static site.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const hasApi = !!BASE
export const apiUrl = (path: string) => `${BASE}${path}`

export async function api<T>(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const res = await fetch(apiUrl(path), { ...init, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return (await res.json()) as T
}
