import site from '@config/site.json'

/**
 * Analytics is off unless an id is configured.
 * Plausible is cookieless and needs no consent; Google Analytics only loads after the visitor accepts.
 */
const GA = (import.meta.env.VITE_GA_ID as string) || site.analytics.gaMeasurementId
const PLAUSIBLE = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string) || site.analytics.plausibleDomain
const CONSENT_KEY = 'tarifo:analytics-consent'

export const needsConsent = !!GA
export const consentAnswered = () => { try { return localStorage.getItem(CONSENT_KEY) !== null } catch { return true } }
export const consentGiven = () => { try { return localStorage.getItem(CONSENT_KEY) === 'yes' } catch { return false } }

function load(src: string, attrs: Record<string, string> = {}) {
  const s = document.createElement('script')
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
  if (PLAUSIBLE) load('https://plausible.io/js/script.js', { 'data-domain': PLAUSIBLE, defer: '' })
  if (GA && consentGiven()) startGoogleAnalytics()
}

export function setConsent(accepted: boolean) {
  try { localStorage.setItem(CONSENT_KEY, accepted ? 'yes' : 'no') } catch { /* private mode */ }
  if (accepted && GA) startGoogleAnalytics()
}
