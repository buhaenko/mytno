import type { BrandTier, Line, Money, Msg, Nuance, Vehicle } from '../../types'
import { money, nothing } from '../money'
import nuanceData from '@config/nuances.json'

const EU_PLANTS = new Set([
  'AUSTRIA', 'BELGIUM', 'BULGARIA', 'CROATIA', 'CZECH REPUBLIC', 'CZECHIA', 'DENMARK', 'ESTONIA', 'FINLAND', 'FRANCE',
  'GERMANY', 'GREECE', 'HUNGARY', 'IRELAND', 'ITALY', 'LATVIA', 'LITHUANIA', 'LUXEMBOURG', 'MALTA', 'NETHERLANDS',
  'POLAND', 'PORTUGAL', 'ROMANIA', 'SLOVAKIA', 'SLOVENIA', 'SPAIN', 'SWEDEN',
])

/** Duty relief depends on where the car was built, not where it was bought. */
export const builtInEu = (v: Vehicle) => !!v.plantCountry && EU_PLANTS.has(v.plantCountry.toUpperCase())

/** Age in years, counted from the middle of the model year. */
export function age(v: Vehicle, now = new Date()): number {
  const firstRegistered = new Date(v.year, 6, 1)
  return Math.max(0, (now.getTime() - firstRegistered.getTime()) / (365.25 * 24 * 3600 * 1000))
}

/** For VAT a car is “new” in its first six months or first 6 000 km, wherever it was bought. */
export const newForVat = (v: Vehicle, now = new Date()) =>
  (v.mileageKm !== undefined && v.mileageKm < 6000) || age(v, now) < 0.5

export const msg = (key: string, params?: Msg['params']): Msg => ({ key, params })

export function line(id: string, label: Msg, kind: Line['kind'], amount: Money, extra: Omit<Partial<Line>, 'id' | 'label' | 'kind' | 'amount'> = {}): Line {
  return { id, label, kind, amount, ...extra }
}

/** Lines whose amount we do not know are shown but never counted. */
export const totalOf = (lines: Line[]): Money =>
  lines.filter((l) => !l.unknown).reduce((acc, l) => money(acc.min + l.amount.min, acc.likely + l.amount.likely, acc.max + l.amount.max), nothing)

/**
 * Conversion work the destination market demands.
 * Only the mandatory items are priced into the total; the rest are shown for context.
 */
export function conversion(route: string, tier: BrandTier): { list: Nuance[]; mandatory: Money } {
  const list = ((nuanceData as unknown as Record<string, Nuance[]>)[route] ?? []) as Nuance[]
  const mandatory = list
    .filter((n) => n.required === 'always')
    .map((n) => between(n.cost[tier]))
    .reduce((a, b) => money(a.min + b.min, a.likely + b.likely, a.max + b.max), nothing)
  return { list, mandatory }
}

function between([min, max]: [number, number]): Money {
  return money(min, (min + max) / 2, max)
}
