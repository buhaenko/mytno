export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'electric' | 'lpg'
export type MarketSpec = 'US' | 'EU' | 'JP' | 'KR' | 'OTHER'
export type BrandTier = 'mass' | 'premium' | 'luxury'
export type Origin = 'US' | 'EU' | 'UA' | 'JP' | 'KR' | 'OTHER'
export type Destination = 'UA' | 'ES' | 'PL' | 'DE' | 'AT' | 'BE' | 'BG' | 'HR' | 'CY' | 'CZ' | 'DK' | 'EE' | 'FI' | 'FR' | 'GR' | 'HU' | 'IE' | 'IT' | 'LV' | 'LT' | 'LU' | 'MT' | 'NL' | 'PT' | 'RO' | 'SK' | 'SI' | 'SE'
export type Currency = 'EUR' | 'USD' | 'UAH'

export interface Vehicle {
  vin?: string
  make: string
  model: string
  year: number
  engineCc?: number
  fuel: Fuel
  powerHp?: number
  batteryKwh?: number
  co2Wltp?: number
  marketSpec: MarketSpec
  plantCountry?: string
  body?: string
  drive?: string
  /** New list price in Spain (base for impuesto de matriculación) */
  listPriceNewEur?: number
  brandTier: BrandTier
  mileageKm?: number
  decodeNotes: string[]
}

export interface RouteInput {
  origin: Origin
  destination: Destination
  purchasePrice: number
  purchaseCurrency: Currency
  /** EUR.1 / origin declaration available (car built in the EU and bought in the EU) */
  hasOriginProof: boolean
  /** Relief on transfer of normal residence (traslado de residencia) */
  residenceTransfer: boolean
}

export type Range = { min: number; likely: number; max: number }
export type Category = 'tax' | 'fees'

/** Translatable message: key + params */
export interface Msg { key: string; params?: Record<string, string | number> }

export interface LineItem {
  key: string
  label: Msg
  category: Category
  /** amounts in EUR */
  range: Range
  note?: Msg
  formula?: string
  /** market estimate rather than an official rate */
  estimate?: boolean
  /** the charge exists but its amount is set by a national formula we do not replicate: shown as — and left out of the total */
  unknown?: boolean
  source?: { title: string; url: string }
}

export interface Nuance {
  id: string
  required: 'always' | 'likely' | 'sometimes'
  cost: Record<BrandTier, [number, number]>
}
export interface CountryInfo { eu: boolean; vat: number; regTax: 'computed' | 'none' | 'national'; customs: string }

export interface NotComputed { key: string; source: { title: string; url: string } }

export interface CalcResult {
  items: LineItem[]
  /** charges that exist in the country but are not computed here (link to the official source) */
  notComputed: NotComputed[]
  nuances: Nuance[]
  warnings: Msg[]
  checklist: Msg[]
  /** mandatory conversion (included in the total) */
  conversionTotal: Range
  /** prominent one-line explanation shown under the total (e.g. why the price does not matter) */
  notice?: Msg
  total: Range
  taxesTotal: Range
  customsValue: number
  meta: Record<string, string | number>
}

export interface FxRates {
  usdUah: number
  eurUah: number
  date: string
  source: 'nbu' | 'fallback'
}
