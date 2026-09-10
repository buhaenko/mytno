/**
 * The country pages: one per place a car can be registered, in every language.
 * The text is assembled from the same config the calculator runs on, so a page
 * cannot drift from the rates below it. Nothing here imports anything — the
 * prerender script runs the very same builder in Node, with the JSON read from
 * disk, and gets the HTML a crawler sees before the app boots.
 */

export interface Source {
  title: string
  url: string
}

/** What `config/countries.json` knows about a place a car is registered in. */
export interface Destination {
  eu: boolean
  vat: number
  customs: string
  regTax: 'computed' | 'estimated' | 'api' | 'regional' | 'none' | 'national'
  /** The authority behind this country's registration tax, where it is not the customs service. */
  regTaxSource?: Source
}

export interface BriefRow {
  label: string
  note: string
  source: Source
}

export interface Brief {
  h1: string
  lead: string
  rows: BriefRow[]
  faq: { q: string; a: string }[]
  cta: string
}

type Translate = (key: string, params?: Record<string, string | number>) => string

/** Duty on a car built outside the EU: the same 10% heading everywhere here. */
export const DUTY_PERCENT = 10

export function countryBrief(
  country: string,
  info: Destination,
  sources: { duty: Source; vat: Source; regTax: Source },
  t: Translate,
): Brief {
  const vat = Math.round(info.vat * 1000) / 10
  const params = { country, duty: DUTY_PERCENT, vat }

  return {
    h1: t('page.country.h1', params),
    lead: t('page.country.lead', params),
    rows: [
      { label: t('line.duty', { rate: DUTY_PERCENT }), note: t('page.country.dutyNote'), source: sources.duty },
      { label: t('line.vat', { rate: vat }), note: t('page.country.vatNote'), source: sources.vat },
      { label: t('line.regTax'), note: t(`page.country.regTax.${info.regTax}`), source: sources.regTax },
    ],
    faq: [
      { q: t('page.faq.cost.q', params), a: t('page.faq.cost.a', params) },
      { q: t('page.faq.vat.q', params), a: t('page.faq.vat.a', params) },
    ],
    cta: t('page.country.cta'),
  }
}

/** A route is the question people actually type: not a country, but a country to a country. */
export interface RouteBrief {
  h1: string
  lead: string
  exampleTitle: string
  exampleNote: string
  totalLabel: string
  faq: { q: string; a: string }[]
}

export function routeBrief(
  from: string,
  to: string,
  example: { car: string; price: string; total: string },
  t: Translate,
): RouteBrief {
  // The arrow keeps both country names in the nominative, so no language has to decline them.
  const params = { from, to, ...example }
  return {
    h1: t('page.route.h1', params),
    lead: t('page.route.lead', params),
    exampleTitle: t('page.route.example', params),
    exampleNote: t('page.route.exampleNote'),
    totalLabel: t('page.route.total'),
    faq: [
      { q: t('page.route.faq.cost.q', params), a: t('page.route.faq.cost.a', params) },
      { q: t('page.route.faq.cheaper.q', params), a: t('page.route.faq.cheaper.a', params) },
    ],
  }
}

export const routePath = (base: string, locale: string, from: string, to: string) =>
  `${base}${locale === 'en' ? '' : `${locale}/`}import/${from.toLowerCase()}-${to.toLowerCase()}/`

/** `/uk/import/us-ua/` names a route; `/uk/import/es/` a country; anything else neither. */
export function routeFromPath(pathname: string, base: string): { from: string; to: string } | null {
  const parts = pathname.slice(base.length).split('/').filter(Boolean)
  const index = parts.indexOf('import')
  const slug = index >= 0 ? parts[index + 1] : undefined
  const match = slug?.match(/^([a-z]{2})-([a-z]{2})$/)
  return match ? { from: match[1]!.toUpperCase(), to: match[2]!.toUpperCase() } : null
}

/** The official page behind each line, given the few links the config holds. */
export interface SourceConfig {
  euDuty: Source
  vat: Source
  regTaxNone: Source
  /** Countries whose registration tax has a law of its own to point at. */
  precise: Record<string, Source>
}

export function sourcesFor(code: string, info: Destination, config: SourceConfig) {
  const precise = config.precise[code] ?? info.regTaxSource
  return {
    duty: code === 'UA' ? config.precise.UA_DUTY! : config.euDuty,
    vat: code === 'UA' ? config.precise.UA_VAT! : config.vat,
    regTax:
      precise ??
      (info.regTax === 'none'
        ? config.regTaxNone
        : { title: new URL(info.customs).hostname.replace('www.', ''), url: info.customs }),
  }
}

/** `/uk/import/es/` and `/import/es/` both name Spain; anything else names none. */
export function countryFromPath(pathname: string, base: string, isCountry: (code: string) => boolean): string | null {
  const parts = pathname.slice(base.length).split('/').filter(Boolean)
  const index = parts.indexOf('import')
  const code = index >= 0 ? parts[index + 1]?.toUpperCase() : undefined
  return code && isCountry(code) ? code : null
}

export const countryPath = (base: string, locale: string, code: string) =>
  `${base}${locale === 'en' ? '' : `${locale}/`}import/${code.toLowerCase()}/`
