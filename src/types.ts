/** The vocabulary the whole app speaks: the car, the trip, and the estimate it produces. */

export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'electric' | 'lpg'
export type Market = 'US' | 'EU' | 'JP' | 'KR' | 'OTHER'
export type BrandTier = 'mass' | 'premium' | 'luxury'
export type Origin = 'US' | 'EU' | 'UA' | 'JP' | 'KR' | 'OTHER'
export type Destination =
  | 'UA' | 'ES' | 'PL' | 'DE' | 'AT' | 'BE' | 'BG' | 'HR' | 'CY' | 'CZ' | 'DK' | 'EE' | 'FI' | 'FR'
  | 'GR' | 'HU' | 'IE' | 'IT' | 'LV' | 'LT' | 'LU' | 'MT' | 'NL' | 'PT' | 'RO' | 'SK' | 'SI' | 'SE'
export type Currency = 'EUR' | 'USD' | 'UAH'

/** A translatable sentence: the key plus whatever the sentence needs filled in. */
export interface Msg {
  key: string
  params?: Record<string, string | number>
}

export interface Vehicle {
  vin?: string
  make: string
  model: string
  year: number
  fuel: Fuel
  /** Which market the car was built for — it decides whether EU type approval is needed. */
  market: Market
  brandTier: BrandTier
  engineCc?: number
  batteryKwh?: number
  powerHp?: number
  co2Wltp?: number
  /** List price when new, in the destination country: the base of the Spanish registration tax. */
  listPriceEur?: number
  mileageKm?: number
  plantCountry?: string
  drive?: string
  /** What the VIN decode and the catalogue had to say, shown behind the “?” next to the car. */
  notes: Msg[]
}

export interface Trip {
  origin: Origin
  destination: Destination
  price: number
  currency: Currency
  /** EUR.1 or an origin declaration: the difference between 0% and 10% duty. */
  hasOriginProof: boolean
  /** Relief on transfer of normal residence. */
  residenceTransfer: boolean
}

/** An amount that is not one number: best case, expected, worst case. All in euro. */
export interface Money {
  min: number
  likely: number
  max: number
}

export interface Source {
  title: string
  url: string
}

export interface Line {
  id: string
  label: Msg
  kind: 'tax' | 'fee'
  amount: Money
  notes?: Msg[]
  formula?: string
  /** A market price rather than a statutory rate. */
  estimate?: boolean
  /** The charge exists but its amount follows a national formula we do not replicate. */
  unknown?: boolean
  source?: Source
}

export interface Nuance {
  id: string
  required: 'always' | 'likely' | 'sometimes'
  cost: Record<BrandTier, [number, number]>
}

export interface Estimate {
  lines: Line[]
  nuances: Nuance[]
  /** One sentence above the breakdown when the result needs explaining. */
  notice?: Msg
  warnings: Msg[]
  steps: Msg[]
  total: Money
  taxes: Money
  customsValue: number
  meta: Record<string, string | number>
}

export interface FxRates {
  usdUah: number
  eurUah: number
  date: string
  source: 'nbu' | 'fallback'
}

export interface CountryInfo {
  eu: boolean
  vat: number
  regTax: 'computed' | 'none' | 'national'
  customs: string
}
