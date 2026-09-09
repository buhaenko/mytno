import type { Currency, FxRates, Money } from '../types'
import { fromEur } from './fx'

const SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', PLN: 'zł', NOK: 'kr', UAH: '₴' }
/** Some currencies are written after the number in every language that uses them. */
const AFTER = new Set<Currency>(['CHF', 'PLN', 'NOK', 'UAH'])

export const money = (min: number, likely = min, max = likely): Money => ({ min, likely, max })
export const exact = (value: number): Money => money(value, value, value)
export const between = ([min, max]: readonly number[]): Money => money(min!, (min! + max!) / 2, max!)
export const nothing: Money = money(0)

export const plus = (a: Money, b: Money): Money => money(a.min + b.min, a.likely + b.likely, a.max + b.max)
export const times = (a: Money, k: number): Money => money(a.min * k, a.likely * k, a.max * k)
export const sum = (all: Money[]): Money => all.reduce(plus, nothing)
export const isRange = (m: Money): boolean => Math.abs(m.max - m.min) >= 1

export const percent = (rate: number) => `${(rate * 100).toLocaleString('en', { maximumFractionDigits: 2 })}%`

export function format(amountEur: number, currency: Currency, fx: FxRates, locale = 'en'): string {
  const value = fromEur(amountEur, currency, fx)
  const shown = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
  return AFTER.has(currency) ? `${shown} ${SYMBOL[currency]}` : `${SYMBOL[currency]}${shown}`
}
