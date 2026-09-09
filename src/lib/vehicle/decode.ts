import type { Fuel } from '../../types'

export interface Decoded {
  make?: string
  model?: string
  year?: number
  trim?: string
  series?: string
  body?: string
  drive?: string
  engineCc?: number
  powerHp?: number
  batteryKwh?: number
  fuel: Fuel
  plantCountry?: string
  /** NHTSA reported no problems with this VIN. */
  clean: boolean
  errorText: string
}

const NHTSA = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/'

/** NHTSA answers cross-origin, so the browser asks it itself. */
async function fetchRaw(vin: string, signal?: AbortSignal): Promise<Record<string, string>> {
  const res = await fetch(`${NHTSA}${encodeURIComponent(vin)}?format=json`, { signal })
  if (!res.ok) throw new Error(`NHTSA ${res.status}`)
  const json = (await res.json()) as { Results: Record<string, string>[] }
  return json.Results?.[0] ?? {}
}

const text = (v?: string) => (v && v.trim() ? v.trim() : undefined)
const num = (v?: string) => (v && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : undefined)

function fuelOf(raw: Record<string, string>): Fuel {
  const primary = (raw.FuelTypePrimary ?? '').toLowerCase()
  const electrification = (raw.ElectrificationLevel ?? '').toLowerCase()
  if (primary.includes('electric') && !raw.DisplacementCC) return 'electric'
  if (electrification.includes('plug')) return 'phev'
  if (electrification.includes('hybrid') || (raw.FuelTypeSecondary ?? '').toLowerCase().includes('electric')) return 'hybrid'
  if (primary.includes('diesel')) return 'diesel'
  if (primary.includes('lpg') || primary.includes('propane')) return 'lpg'
  return 'petrol'
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bBmw\b/, 'BMW').replace(/\bGmc\b/, 'GMC')
}

export async function decodeVin(vin: string, signal?: AbortSignal): Promise<Decoded> {
  const raw = await fetchRaw(vin, signal)
  const cc = num(raw.DisplacementCC)
  return {
    make: text(raw.Make),
    model: text(raw.Model),
    year: num(raw.ModelYear),
    trim: text(raw.Trim),
    series: text(raw.Series),
    body: text(raw.BodyClass),
    drive: text(raw.DriveType),
    engineCc: cc ? Math.round(cc) : undefined,
    powerHp: num(raw.EngineHP),
    batteryKwh: num(raw.BatteryKWh),
    fuel: fuelOf(raw),
    plantCountry: text(raw.PlantCountry),
    clean: raw.ErrorCode === '0',
    errorText: text(raw.ErrorText) ?? '',
  }
}
