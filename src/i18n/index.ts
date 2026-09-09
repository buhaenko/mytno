import { computed, ref } from 'vue'
import { isLocale, type Locale } from './locales'

export { LOCALES, LOCALE_NAMES, isLocale, type Locale } from './locales'

type Messages = Record<string, string>

/** One file per language, loaded on demand. A missing file simply falls back to English. */
const files = import.meta.glob<{ default: Messages }>('./messages/*.ts')
const loaders = Object.fromEntries(
  Object.entries(files)
    .map(([path, load]) => [path.match(/\/([a-z]{2})\.ts$/)?.[1], load] as const)
    .filter(([code]) => isLocale(code)),
) as Record<Locale, () => Promise<{ default: Messages }>>

const locale = ref<Locale>('en')
const messages = ref<Messages>({})
const english = ref<Messages>({})

/** Where to look for the visitor's language, in order of how deliberate the choice is. */
export function detectLocale(): Locale {
  const fromPath = location.pathname.slice(import.meta.env.BASE_URL.length).split('/').filter(Boolean)[0]
  if (isLocale(fromPath)) return fromPath

  const fromQuery = new URLSearchParams(location.search).get('lang')
  if (isLocale(fromQuery)) return fromQuery

  for (const tag of navigator.languages ?? [navigator.language]) {
    const short = tag.toLowerCase().split('-')[0]!
    if (isLocale(short)) return short
  }

  return 'en'
}

export async function setLocale(next: Locale) {
  const load = loaders[next] ?? loaders.en
  const [chosen, base] = await Promise.all([
    load(),
    next === 'en' ? Promise.resolve({ default: {} as Messages }) : loaders.en(),
  ])
  messages.value = chosen.default
  english.value = base.default
  locale.value = next
  document.documentElement.lang = next
}

/** `t('line.duty', { rate: 10 })` → “Customs duty 10%”. */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = messages.value[key] ?? english.value[key] ?? key
  if (!params) return template
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
}

export function useI18n() {
  const regionNames = computed(() => {
    try { return new Intl.DisplayNames([locale.value], { type: 'region' }) } catch { return null }
  })
  /** “DE” → “Germany”, in whatever language is on screen. */
  const region = (code: string) => {
    try { return regionNames.value?.of(code) ?? code } catch { return code }
  }
  return { t, locale, region, setLocale }
}
