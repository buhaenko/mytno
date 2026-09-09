import type { Fuel } from '../../types'

/**
 * The EPA catalogue: every model sold in the US from 1984 to 2026, one JSON file per year.
 * A version is a tuple to keep the files small: see scripts/build-catalog.mjs.
 */
export type Version = [cc: number, cylinders: number, fuel: string, co2: number, gearbox: string, drive: string, motor: string, epaId: number]
export type Year = Record<string, Record<string, Version[]>>
export interface Index {
  years: number[]
  makesByYear: Record<string, string[]>
  source: string
  built: string
}

const base = import.meta.env.BASE_URL
const years = new Map<number, Promise<Year>>()
let index: Promise<Index> | undefined

export function loadIndex(): Promise<Index> {
  index ??= fetch(`${base}catalog/index.json`).then((r) => r.json() as Promise<Index>)
  return index
}

export function loadYear(year: number): Promise<Year> {
  let pending = years.get(year)
  if (!pending) {
    pending = fetch(`${base}catalog/${year}.json`).then((r) => r.json() as Promise<Year>)
    years.set(year, pending)
  }
  return pending
}

export function versionFuel([, , fuel]: Version): Fuel {
  return fuel === 'diesel' || fuel === 'hybrid' || fuel === 'phev' || fuel === 'electric' ? fuel : 'petrol'
}

const shortDrive = (drive: string) =>
  drive.replace('-Wheel Drive', 'WD').replace('Front', 'F').replace('Rear', 'R').replace('All', 'A').replace('4WD or ', '').replace('Part-time ', '')

/** A readable one-line label, translated through `words`. */
export function versionLabel(v: Version, words: (key: string, params?: Record<string, string | number>) => string): string {
  const [cc, cylinders, fuel, co2, gearbox, drive, motor] = v
  const parts = fuel === 'electric'
    ? [words('car.version.electric'), motor]
    : [`${(cc / 1000).toFixed(1)} L`, cylinders ? words('car.version.cyl', { n: cylinders }) : '', words(`car.version.${fuel}`)]
  parts.push(gearbox.replace(/\s*\(.*\)/, ''), shortDrive(drive))
  if (co2) parts.push(`${co2} g/km`)
  return parts.filter(Boolean).join(' · ')
}

/** Best match for a decoded model name (NHTSA writes “A4 quattro Premium”, the catalogue “A4 quattro”). */
export function findModel(year: Year, make: string, name: string): { model: string; versions: Version[] } | undefined {
  const makeKey = Object.keys(year).find(
    (k) => k.toLowerCase() === make.toLowerCase() || k.toLowerCase().startsWith(make.toLowerCase().split(' ')[0]!),
  )
  if (!makeKey) return undefined

  const words = name.toLowerCase().split(/[\s/()-]+/).filter(Boolean)
  let best: { model: string; score: number } | undefined
  for (const model of Object.keys(year[makeKey]!)) {
    const modelWords = model.toLowerCase().split(/[\s/()-]+/).filter(Boolean)
    const shared = modelWords.filter((w) => words.includes(w)).length
    if (!shared) continue
    const score = shared * 10 - Math.abs(modelWords.length - shared)
    if (!best || score > best.score) best = { model, score }
  }
  return best ? { model: best.model, versions: year[makeKey]![best.model]! } : undefined
}
