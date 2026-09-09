/** The languages the app speaks. */
export const LOCALES = [
  'uk', 'en', 'es', 'de', 'pl', 'fr', 'it', 'pt', 'nl', 'ro', 'cs', 'sk',
  'hu', 'bg', 'hr', 'sl', 'lt', 'lv', 'et', 'fi', 'sv', 'da', 'el',
] as const

export type Locale = (typeof LOCALES)[number]

export const LOCALE_NAMES: Record<Locale, string> = {
  uk: 'Українська', en: 'English', es: 'Español', de: 'Deutsch', pl: 'Polski', fr: 'Français',
  it: 'Italiano', pt: 'Português', nl: 'Nederlands', ro: 'Română', cs: 'Čeština', sk: 'Slovenčina',
  hu: 'Magyar', bg: 'Български', hr: 'Hrvatski', sl: 'Slovenščina', lt: 'Lietuvių', lv: 'Latviešu',
  et: 'Eesti', fi: 'Suomi', sv: 'Svenska', da: 'Dansk', el: 'Ελληνικά',
}

export const isLocale = (value: string | null | undefined): value is Locale =>
  !!value && (LOCALES as readonly string[]).includes(value)
