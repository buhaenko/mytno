import site from '@config/site.json'

/**
 * Analytics is off unless an id is configured. Cloudflare Web Analytics and Plausible are
 * cookieless and start right away; Google Analytics only loads after the visitor accepts.
 */
const GA = (import.meta.env.VITE_GA_ID as string) || site.analytics.gaMeasurementId
const PLAUSIBLE = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string) || site.analytics.plausibleDomain
const CLOUDFLARE = (import.meta.env.VITE_CF_BEACON as string) || site.analytics.cloudflareToken
const CONSENT_KEY = 'mytno:analytics-consent'

/**
 * Only the real address is measured. Preview deploys, `mytno.pages.dev`, whatever is
 * left of the old GitHub Pages host and a developer's own machine all serve the same
 * bundle, and every one of them was showing up as its own line in the statistics.
 */
const onSite = typeof location !== 'undefined' && location.hostname === site.host

export const needsConsent = !!GA
export const consentAnswered = () => { try { return localStorage.getItem(CONSENT_KEY) !== null } catch { return true } }
export const consentGiven = () => { try { return localStorage.getItem(CONSENT_KEY) === 'yes' } catch { return false } }

function load(src: string, attrs: Record<string, string> = {}, module = false) {
  const s = document.createElement('script')
  if (module) s.type = 'module'
  s.async = true
  s.src = src
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v)
  document.head.appendChild(s)
}

function startGoogleAnalytics() {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
  w.dataLayer = w.dataLayer ?? []
  w.gtag = function gtag() { w.dataLayer!.push(arguments) }
  w.gtag('js', new Date())
  w.gtag('config', GA, { anonymize_ip: true })
  load(`https://www.googletagmanager.com/gtag/js?id=${GA}`)
}

/** Call once at boot. Cookieless analytics starts right away; GA waits for a stored yes. */
export function initAnalytics() {
  if (!onSite) return
  if (CLOUDFLARE) {
    load('https://static.cloudflareinsights.com/beacon.min.js', { 'data-cf-beacon': JSON.stringify({ token: CLOUDFLARE }) }, true)
  }
  if (PLAUSIBLE) load('https://plausible.io/js/script.js', { 'data-domain': PLAUSIBLE, defer: '' })
  if (GA && consentGiven()) startGoogleAnalytics()
}

export function setConsent(accepted: boolean) {
  try { localStorage.setItem(CONSENT_KEY, accepted ? 'yes' : 'no') } catch { /* private mode */ }
  if (accepted && GA && onSite) startGoogleAnalytics()
}
