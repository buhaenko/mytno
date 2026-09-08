import type { BrandTier, LineItem, Nuance, Range, Vehicle } from '../../types'
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
  // приймаємо першу реєстрацію ≈ середина модельного року
  const first = new Date(v.year, 6, 1)
  return Math.max(0, (now.getTime() - first.getTime()) / (365.25 * 24 * 3600 * 1000))
}

export function nuancesFor(key: string, tier: BrandTier): { list: Nuance[]; total: Range } {
  const list = ((nuancesData as unknown as Record<string, Nuance[]>)[key] ?? []) as Nuance[]
  let min = 0
  let likely = 0
  let max = 0
  for (const n of list) {
    const [lo, hi] = n.cost[tier]
    const mid = (lo + hi) / 2
    max += hi
    if (n.required === 'always') {
      min += lo
      likely += mid
    } else if (n.required === 'likely') {
      likely += mid
    } else {
      likely += mid * 0.35
    }
  }
  return { list, total: r(min, likely, max) }
}

export function item(
  key: string,
  label: string,
  category: LineItem['category'],
  range: Range,
  extra: Partial<Pick<LineItem, 'note' | 'formula' | 'estimate' | 'source'>> = {},
): LineItem {
  return { key, label, category, range, ...extra }
}

export function sumItems(items: LineItem[]): Range {
  return items.reduce((acc, it) => ({ min: acc.min + it.range.min, likely: acc.likely + it.range.likely, max: acc.max + it.range.max }), { min: 0, likely: 0, max: 0 })
}

export { span }
