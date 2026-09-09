import type { Locale } from '../i18n'

/**
 * Every screen is a URL. The language is a path segment, the calculation is the
 * query string, and that is the whole sharing mechanism: whoever copies the
 * address bar copies the result, with nothing stored anywhere.
 */
const BASE = import.meta.env.BASE_URL

export const appUrl = (locale: Locale, query = '') =>
  `${location.origin}${BASE}${locale === 'en' ? '' : `${locale}/`}${query}`

/** The same address without the origin, which is what history.replaceState wants. */
export const appPath = (locale: Locale, query = '') => appUrl(locale, query).slice(location.origin.length)
