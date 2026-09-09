import type { Currency, Origin } from '../types'
import data from '@config/origins.json'
import currencies from '@config/currencies.json'

/** Country of purchase → the customs rules that apply (see config/origins.json). */
export const ORIGIN_COUNTRIES = data.countries as { code: string; group: Origin }[]
export const ORIGIN_GROUP: Record<string, Origin> = Object.fromEntries(ORIGIN_COUNTRIES.map((c) => [c.code, c.group]))

/** What a car is priced in there — the euro wherever no other currency is published. */
export const currencyOf = (country: string | null): Currency =>
  ((country && (currencies.byCountry as Record<string, string>)[country]) ?? currencies.default) as Currency
