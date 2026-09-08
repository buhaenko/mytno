import type { Currency, FxRates, Range } from '../types'
import { fromEur } from './fx'

const SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$', UAH: '₴' }

export function fmt(amountEur: number, cur: Currency, fx: FxRates, opts: { decimals?: number } = {}): string {
  const v = fromEur(amountEur, cur, fx)
  const decimals = opts.decimals ?? 0
  const s = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v)
  return cur === 'UAH' ? `${s} ${SYMBOL[cur]}` : `${SYMBOL[cur]}${s}`
}

export function fmtRange(r: Range, cur: Currency, fx: FxRates): string {
  if (Math.abs(r.max - r.min) < 1) return fmt(r.likely, cur, fx)
  return `${fmt(r.min, cur, fx)} – ${fmt(r.max, cur, fx)}`
}

export const r = (min: number, likely: number, max: number): Range => ({ min, likely, max })
export const fixed = (v: number): Range => ({ min: v, likely: v, max: v })
export const span = ([min, max]: [number, number] | number[], likely?: number): Range => ({
  min: min!,
  likely: likely ?? (min! + max!) / 2,
  max: max!,
})
export const addR = (a: Range, b: Range): Range => ({ min: a.min + b.min, likely: a.likely + b.likely, max: a.max + b.max })
export const scaleR = (a: Range, k: number): Range => ({ min: a.min * k, likely: a.likely * k, max: a.max * k })
export const zero: Range = { min: 0, likely: 0, max: 0 }
export const pct = (v: number) => `${(v * 100).toLocaleString('uk-UA', { maximumFractionDigits: 2 })}%`
