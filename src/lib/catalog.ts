import type { Fuel } from '../types'

/** [cc, cylinders, fuel, co2 g/km (EPA), transmission, drive, electric motor, epaId] */
export type CatalogVersion = [number, number, string, number, string, string, string, number]
export type CatalogYear = Record<string, Record<string, CatalogVersion[]>>
export interface CatalogIndex { years: number[]; makesByYear: Record<string, string[]>; source: string; built: string }

const base = import.meta.env.BASE_URL
let indexP: Promise<CatalogIndex> | undefined
const years = new Map<number, Promise<CatalogYear>>()

export function loadIndex(): Promise<CatalogIndex> {
  indexP ??= fetch(`${base}catalog/index.json`).then((r) => r.json() as Promise<CatalogIndex>)
  return indexP
}
export function loadYear(y: number): Promise<CatalogYear> {
  let p = years.get(y)
  if (!p) {
    p = fetch(`${base}catalog/${y}.json`).then((r) => r.json() as Promise<CatalogYear>)
    years.set(y, p)
  }
  return p
}

export function versionFuel(v: CatalogVersion): Fuel {
  const f = v[2]
  if (f === 'petrol' || f === 'diesel' || f === 'hybrid' || f === 'phev' || f === 'electric') return f
  return 'petrol'
}

export function versionLabel(v: CatalogVersion): string {
  const [cc, cyl, fuel, co2, trany, drive, ev] = v
  const parts: string[] = []
  if (fuel === 'electric') parts.push('electric', ev || '')
  else {
    parts.push(`${(cc / 1000).toFixed(1)} L`, cyl ? `${cyl} cyl.` : '')
    parts.push({ petrol: 'petrol', diesel: 'diesel', hybrid: 'hybrid', phev: 'plug-in', cng: 'CNG', hydrogen: 'H₂' }[fuel] ?? fuel)
  }
  parts.push(trany.replace(/\s*\(.*\)/, ''), drive.replace('-Wheel Drive', 'WD').replace('Front', 'F').replace('Rear', 'R').replace('All', 'A').replace('4WD or ', '').replace('Part-time ', ''))
  if (co2) parts.push(`${co2} g/km`)
  return parts.filter(Boolean).join(' · ')
}

/** Best catalogue model match by name (NHTSA model + series + trim). */
export function matchCatalogModel(year: CatalogYear, make: string, name: string): { model: string; versions: CatalogVersion[] } | undefined {
  const mk = Object.keys(year).find((k) => k.toLowerCase() === make.toLowerCase() || k.toLowerCase().startsWith(make.toLowerCase().split(' ')[0]!))
  if (!mk) return undefined
  const tokens = name.toLowerCase().split(/[\s/()-]+/).filter(Boolean)
  let best: { model: string; score: number } | undefined
  for (const model of Object.keys(year[mk]!)) {
    const mt = model.toLowerCase().split(/[\s/()-]+/).filter(Boolean)
    const overlap = mt.filter((t) => tokens.includes(t)).length
    if (!overlap) continue
    const score = overlap * 10 - Math.abs(mt.length - overlap) // penalise extra words in the catalogue name
    if (!best || score > best.score) best = { model, score }
  }
  return best ? { model: best.model, versions: year[mk]![best.model]! } : undefined
}
