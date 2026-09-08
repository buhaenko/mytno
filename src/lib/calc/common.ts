import type { BrandTier, LineItem, Msg, Nuance, Range, Vehicle } from '../../types'
import { r, span } from '../money'
import nuancesData from '../../data/nuances.json'

export const EU_PLANTS = new Set([
  'AUSTRIA', 'BELGIUM', 'BULGARIA', 'CROATIA', 'CZECH REPUBLIC', 'CZECHIA', 'DENMARK', 'ESTONIA', 'FINLAND', 'FRANCE',
  'GERMANY', 'GREECE', 'HUNGARY', 'IRELAND', 'ITALY', 'LATVIA', 'LITHUANIA', 'LUXEMBOURG', 'MALTA', 'NETHERLANDS',
  'POLAND', 'PORTUGAL', 'ROMANIA', 'SLOVAKIA', 'SLOVENIA', 'SPAIN', 'SWEDEN',
])

export function isEuMade(v: Vehicle): boolean {
  return !!v.plantCountry && EU_PLANTS.has(v.plantCountry.toUpperCase())
}

export function ageYears(v: Vehicle, now = new Date()): number {
  const first = new Date(v.year, 6, 1)
  return Math.max(0, (now.getTime() - first.getTime()) / (365.25 * 24 * 3600 * 1000))
}

export const m = (key: string, params?: Record<string, string | number>): Msg => ({ key, params })

/** Conversion items: mandatory ones are summed (included in the total), the rest are informational. */
export function nuancesFor(key: string, tier: BrandTier): { list: Nuance[]; mandatory: Range } {
  const list = ((nuancesData as unknown as Record<string, Nuance[]>)[key] ?? []) as Nuance[]
  let min = 0, likely = 0, max = 0
  for (const n of list) {
    if (n.required !== 'always') continue
    const [lo, hi] = n.cost[tier]
    min += lo; likely += (lo + hi) / 2; max += hi
  }
  return { list, mandatory: r(min, likely, max) }
}

export function item(key: string, label: Msg, category: LineItem['category'], range: Range, extra: Partial<Pick<LineItem, 'note' | 'formula' | 'estimate' | 'source'>> = {}): LineItem {
  return { key, label, category, range, ...extra }
}

export function sumItems(items: LineItem[]): Range {
  return items.reduce((acc, it) => ({ min: acc.min + it.range.min, likely: acc.likely + it.range.likely, max: acc.max + it.range.max }), { min: 0, likely: 0, max: 0 })
}

export { span }
