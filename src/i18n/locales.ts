/**
 * The languages the app speaks. The other message files are still in `messages/`,
 * unlisted: adding one back is a line here, and every page it needs is built again.
 */
export const LOCALES = ['uk', 'en', 'es', 'de', 'pl', 'fr'] as const

export type Locale = (typeof LOCALES)[number]

export const LOCALE_NAMES: Record<Locale, string> = {
  uk: 'Українська', en: 'English', es: 'Español', de: 'Deutsch', pl: 'Polski', fr: 'Français',
}

export const isLocale = (value: string | null | undefined): value is Locale =>
  !!value && (LOCALES as readonly string[]).includes(value)
