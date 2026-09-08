export interface NhtsaDecoded {
  make?: string
  model?: string
  modelYear?: number
  trim?: string
  series?: string
  body?: string
  drive?: string
  displacementCc?: number
  cylinders?: number
  hp?: number
  fuel?: string
  fuelSecondary?: string
  electrification?: string
  batteryKwh?: number
  plantCountry?: string
  plantCity?: string
  errorCode: string
  errorText: string
  /** true when the decode reported no errors */
  clean: boolean
}

const API = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/'

export async function decodeVin(vin: string, signal?: AbortSignal): Promise<NhtsaDecoded> {
  const res = await fetch(`${API}${encodeURIComponent(vin)}?format=json`, { signal })
  if (!res.ok) throw new Error(`NHTSA ${res.status}`)
  const json = (await res.json()) as { Results: Record<string, string>[] }
  const r = json.Results?.[0] ?? {}
  const num = (v?: string) => (v && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined)
  const str = (v?: string) => (v && v.trim() !== '' ? v.trim() : undefined)
  const errorCode = str(r.ErrorCode) ?? ''
  return {
    make: str(r.Make),
    model: str(r.Model),
    modelYear: num(r.ModelYear),
    trim: str(r.Trim),
    series: str(r.Series),
    body: str(r.BodyClass),
    drive: str(r.DriveType),
    displacementCc: num(r.DisplacementCC),
    cylinders: num(r.EngineCylinders),
    hp: num(r.EngineHP),
    fuel: str(r.FuelTypePrimary),
    fuelSecondary: str(r.FuelTypeSecondary),
    electrification: str(r.ElectrificationLevel),
    batteryKwh: num(r.BatteryKWh),
    plantCountry: str(r.PlantCountry),
    plantCity: str(r.PlantCity),
    errorCode,
    errorText: str(r.ErrorText) ?? '',
    clean: errorCode === '0',
  }
}

export function mapFuel(d: NhtsaDecoded): 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'electric' | 'lpg' {
  const f = (d.fuel ?? '').toLowerCase()
  const e = (d.electrification ?? '').toLowerCase()
  if (f.includes('electric') && !d.displacementCc) return 'electric'
  if (e.includes('plug')) return 'phev'
  if (e.includes('hybrid') || (d.fuelSecondary ?? '').toLowerCase().includes('electric')) return 'hybrid'
  if (f.includes('diesel')) return 'diesel'
  if (f.includes('lpg') || f.includes('propane')) return 'lpg'
  return 'petrol'
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bBmw\b/, 'BMW').replace(/\bGmc\b/, 'GMC')
}
