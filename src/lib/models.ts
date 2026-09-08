import type { BrandTier, Fuel, Vehicle } from '../types'
import modelsData from '../data/models.json'

export interface ModelEngine { label: string; cc: number; fuel: Fuel; hp: number; co2: number; listEur: number; kwh?: number }
export interface ModelEntry { make: string; model: string; years: [number, number]; tier: BrandTier; engines: ModelEngine[] }

export const MODELS = modelsData as ModelEntry[]
export const MAKES = [...new Set(MODELS.map((m) => m.make))].sort()

const LUXURY = ['porsche', 'bentley', 'rolls', 'maserati', 'land rover', 'range rover', 'cadillac', 'lincoln', 'aston', 'ferrari', 'lamborghini', 'maybach']
const PREMIUM = ['audi', 'bmw', 'mercedes', 'volvo', 'lexus', 'acura', 'infiniti', 'alfa', 'tesla', 'genesis', 'jaguar', 'mini', 'polestar', 'cupra', 'ds']

export function tierForMake(make: string): BrandTier {
  const m = make.toLowerCase()
  if (LUXURY.some((x) => m.includes(x))) return 'luxury'
  if (PREMIUM.some((x) => m.includes(x))) return 'premium'
  return 'mass'
}

/** Finds the closest reference engine for a car (by make, model, year, displacement, power and fuel). */
export function matchReference(v: Pick<Vehicle, 'make' | 'model' | 'year' | 'engineCc' | 'fuel' | 'powerHp'>): { entry: ModelEntry; engine: ModelEngine } | undefined {
  const make = v.make.toLowerCase()
  const modelTokens = v.model.toLowerCase().split(/[\s/()-]+/).filter(Boolean)
  const candidates = MODELS.filter((m) => {
    if (!make.includes(m.make.toLowerCase().split(/[\s-]/)[0]!)) return false
    const mm = m.model.toLowerCase()
    return modelTokens.some((t) => t.length >= 2 && mm.split(/[\s/()-]+/).includes(t))
  }).filter((m) => v.year >= m.years[0] - 1 && v.year <= m.years[1] + 1)
  if (!candidates.length) return undefined
  let best: { entry: ModelEntry; engine: ModelEngine; score: number } | undefined
  for (const entry of candidates) {
    for (const engine of entry.engines) {
      let score = 0
      if (v.engineCc) score += Math.abs(engine.cc - v.engineCc) / 100
      else if (engine.cc) score += 5
      if (v.powerHp && engine.hp) score += Math.abs(engine.hp - v.powerHp) / 15
      if (engine.fuel !== v.fuel) score += 10
      if (!best || score < best.score) best = { entry, engine, score }
    }
  }
  return best ? { entry: best.entry, engine: best.engine } : undefined
}
