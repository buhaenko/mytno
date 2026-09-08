import { computed, ref } from 'vue'

export const LOCALES = ['uk', 'en', 'es', 'de', 'pl', 'fr', 'it', 'pt', 'nl', 'ro', 'cs', 'sk', 'hu', 'bg', 'hr', 'sl', 'lt', 'lv', 'et', 'fi', 'sv', 'da', 'el'] as const
export type Locale = (typeof LOCALES)[number]
export const LOCALE_NAMES: Record<Locale, string> = {
  uk: 'Українська', en: 'English', es: 'Español', de: 'Deutsch', pl: 'Polski', fr: 'Français', it: 'Italiano', pt: 'Português', nl: 'Nederlands', ro: 'Română',
  cs: 'Čeština', sk: 'Slovenčina', hu: 'Magyar', bg: 'Български', hr: 'Hrvatski', sl: 'Slovenščina', lt: 'Lietuvių', lv: 'Latviešu', et: 'Eesti', fi: 'Suomi', sv: 'Svenska', da: 'Dansk', el: 'Ελληνικά',
}
/** Default language per country (geo/IP). */
export const COUNTRY_LOCALE: Record<string, Locale> = {
  UA: 'uk', ES: 'es', DE: 'de', AT: 'de', PL: 'pl', FR: 'fr', BE: 'fr', LU: 'fr', IT: 'it', PT: 'pt', NL: 'nl', RO: 'ro', MD: 'ro', CZ: 'cs', SK: 'sk', HU: 'hu',
  BG: 'bg', HR: 'hr', SI: 'sl', LT: 'lt', LV: 'lv', EE: 'et', FI: 'fi', SE: 'sv', DK: 'da', GR: 'el', CY: 'el', IE: 'en', MT: 'en', GB: 'en', US: 'en', CH: 'de',
}

export function isLocale(x: string | null | undefined): x is Locale {
  return !!x && (LOCALES as readonly string[]).includes(x)
}

type Messages = Record<string, string>
// glob: a missing translation file does not break the build — the locale falls back to English
const files = import.meta.glob<{ default: Messages }>('./messages/*.ts')
const loaders: Partial<Record<Locale, () => Promise<{ default: Messages }>>> = {}
for (const [path, loader] of Object.entries(files)) {
  const l = path.match(/\/([a-z]{2})\.ts$/)?.[1]
  if (isLocale(l)) loaders[l] = loader
}

const locale = ref<Locale>('en')
const msgs = ref<Messages>({})
const fallback = ref<Messages>({})
const loaded = ref(false)

/** Order: /uk/… path, ?lang=, browser language, geo (optional) */
export async function detectLocale(geo?: () => Promise<string | null>): Promise<Locale> {
  const seg = location.pathname.slice(import.meta.env.BASE_URL.length).split('/').filter(Boolean)[0]
  if (isLocale(seg)) return seg
  const q = new URLSearchParams(location.search).get('lang')
  if (isLocale(q)) return q
  for (const l of navigator.languages ?? [navigator.language]) {
    const short = l.toLowerCase().split('-')[0]!
    if (isLocale(short)) return short
  }
  if (geo) { try { const c = await geo(); const l = c ? COUNTRY_LOCALE[c.toUpperCase()] : undefined; if (l) return l } catch { /* noop */ } }
  return 'en'
}

export async function setLocale(l: Locale) {
  const load = loaders[l] ?? loaders.en!
  const [m, f] = await Promise.all([load(), l === 'en' ? Promise.resolve({ default: {} as Messages }) : loaders.en!()])
  msgs.value = m.default
  fallback.value = f.default
  locale.value = l
  loaded.value = true
  document.documentElement.lang = l
}

export function t(key: string, params?: Record<string, string | number>): string {
  let s = msgs.value[key] ?? fallback.value[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export function useI18n() {
  const regionNames = computed(() => { try { return new Intl.DisplayNames([locale.value], { type: 'region' }) } catch { return null } })
  const region = (code: string) => { try { return regionNames.value?.of(code) ?? code } catch { return code } }
  return { t, locale, loaded, region, setLocale }
}

export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)
}
