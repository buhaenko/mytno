import type { BrandTier, Fuel, Vehicle } from '../../types'
import data from '@config/models.json'

/**
 * A hand-checked list of European versions: WLTP CO₂ and list prices that US data never carries.
 * It fills the gaps the VIN decode leaves for Spain and Austria.
 */
export interface Engine { label: string; cc: number; fuel: Fuel; hp: number; co2: number; listEur: number; kwh?: number }
export interface Model { make: string; model: string; years: [number, number]; tier: BrandTier; engines: Engine[] }

export const MODELS = data as Model[]
export const MAKES = [...new Set(MODELS.map((m) => m.make))].sort()

const LUXURY = ['porsche', 'bentley', 'rolls', 'maserati', 'land rover', 'range rover', 'cadillac', 'lincoln', 'aston', 'ferrari', 'lamborghini', 'maybach']
const PREMIUM = ['audi', 'bmw', 'mercedes', 'volvo', 'lexus', 'acura', 'infiniti', 'alfa', 'tesla', 'genesis', 'jaguar', 'mini', 'polestar', 'cupra', 'ds']

/** Brand class sets the price of the parts a conversion needs. */
export function tierForMake(make: string): BrandTier {
  const name = make.toLowerCase()
  if (LUXURY.some((x) => name.includes(x))) return 'luxury'
  if (PREMIUM.some((x) => name.includes(x))) return 'premium'
  return 'mass'
}

type Query = Pick<Vehicle, 'make' | 'model' | 'year' | 'engineCc' | 'fuel' | 'powerHp'>

/** Closest engine in the list, or nothing when the model is not covered. */
export function findEngine(v: Query): { model: Model; engine: Engine } | undefined {
  const make = v.make.toLowerCase()
  const words = v.model.toLowerCase().split(/[\s/()-]+/).filter(Boolean)

  const candidates = MODELS.filter((m) => {
    if (!make.includes(m.make.toLowerCase().split(/[\s-]/)[0]!)) return false
    const modelWords = m.model.toLowerCase().split(/[\s/()-]+/)
    return words.some((w) => w.length >= 2 && modelWords.includes(w))
  }).filter((m) => v.year >= m.years[0] - 1 && v.year <= m.years[1] + 1)

  let best: { model: Model; engine: Engine; distance: number } | undefined
  for (const model of candidates) {
    for (const engine of model.engines) {
      let distance = 0
      if (v.engineCc) distance += Math.abs(engine.cc - v.engineCc) / 100
      else if (engine.cc) distance += 5
      if (v.powerHp && engine.hp) distance += Math.abs(engine.hp - v.powerHp) / 15
      if (engine.fuel !== v.fuel) distance += 10
      if (!best || distance < best.distance) best = { model, engine, distance }
    }
  }
  return best && { model: best.model, engine: best.engine }
}
