import type { BrandTier, Fuel, Vehicle } from '../types'

/**
 * A page per car model, for the person who arrives from a search for their own car rather
 * than for a country. The list is the hand-checked one in `config/models.json` — twenty-eight
 * models whose CO₂ is the certified European figure and whose price is a real list price,
 * not the American cycle the catalogue carries. Fewer pages, every number citable.
 *
 * Each page prices the model **as it left the showroom**: its own list price, registered new
 * in the last year it was built. Both are printed on the page, so nothing is assumed behind
 * the reader's back, and the calculator underneath takes their own car from there.
 *
 * Like `pages.ts`, this file imports nothing: the prerender runs it in Node with the JSON read
 * off disk, the app runs it with the JSON bundled, and neither needs the other's resolver.
 */
export interface CarEngine { label: string; cc?: number; fuel: string; hp?: number; co2?: number; kwh?: number; listEur: number }
export interface CarModel { make: string; model: string; years: number[]; tier: string; engines: CarEngine[] }

/** “Audi” + “A4 (B9)” → “audi-a4”: the generation code is for us, not for the address bar. */
export const carSlug = (car: CarModel) =>
  `${car.make} ${car.model.replace(/\s*\([^)]*\)/g, '')}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const carPath = (base: string, locale: string, slug: string) =>
  `${base}${locale === 'en' ? '' : `${locale}/`}car/${slug}/`

/** `/uk/car/audi-a4/` names a model; anything else does not. */
export function carFromPath(pathname: string, base: string, cars: CarModel[]): string | null {
  const rest = pathname.slice(base.length).replace(/^\/+/, '')
  const parts = rest.split('/').filter(Boolean)
  const at = parts[0]?.length === 2 ? 1 : 0
  if (parts[at] !== 'car' || !parts[at + 1]) return null
  const slug = parts[at + 1]!
  return cars.some((car) => carSlug(car) === slug) ? slug : null
}

export const carBySlug = (slug: string, cars: CarModel[]) => cars.find((car) => carSlug(car) === slug)

/** The model as it left the showroom: its own engine, its own list price, its own last year. */
export function carVehicle(car: CarModel, engine: CarEngine): Vehicle {
  return {
    make: car.make,
    model: car.model,
    year: car.years[1] ?? car.years[0]!,
    fuel: engine.fuel as Fuel,
    market: 'EU',
    brandTier: car.tier as BrandTier,
    engineCc: engine.cc,
    powerHp: engine.hp,
    co2Wltp: engine.co2,
    batteryKwh: engine.kwh,
    listPriceEur: engine.listEur,
    co2Source: engine.co2 ? 'certified' : undefined,
    notes: [],
  }
}

export const carName = (car: CarModel) => `${car.make} ${car.model.replace(/\s*\([^)]*\)/g, '')}`

/**
 * The dozen the home page cycles through, chosen for contrast rather than for sales: the
 * cleanest hybrid against the dirtiest V6, two electrics, a hatchback against an SUV. The
 * order is the order they appear in, and the first of them is what a crawler is shown, so
 * the prerender and the first frame the reader sees are the same car.
 */
export const ROTATION = [
  'Golf 8', 'Model 3', 'X5 (G05)', 'Corolla (E210)', 'E-Class (W213)', 'A4 (B9)',
  'Mustang (S550)', 'Octavia IV', 'RAV4 (XA50)', '3 Series (G20)', 'Model Y', 'RX (AL20)',
]

export const rotation = (cars: CarModel[]) =>
  ROTATION.map((name) => cars.find((car) => car.model === name)).filter((car): car is CarModel => !!car)
