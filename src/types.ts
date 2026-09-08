export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'electric' | 'lpg'
export type MarketSpec = 'US' | 'EU' | 'JP' | 'KR' | 'OTHER'
export type BrandTier = 'mass' | 'premium' | 'luxury'
export type Origin = 'US' | 'EU' | 'UA' | 'JP' | 'KR' | 'OTHER'
export type Destination = 'UA' | 'ES'
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
  /** Ціна нового в Іспанії (база impuesto de matriculación) */
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
  /** Доставка до кордону (входить у митну вартість), у валюті покупки */
  freightToBorder: number
  /** Є EUR.1 / декларація походження (авто зроблене в ЄС і куплене в ЄС) */
  hasOriginProof: boolean
  /** Іспанія: пільга при переїзді (traslado de residencia) */
  residenceTransfer: boolean
}

export type Range = { min: number; likely: number; max: number }
export type Category = 'tax' | 'fees'

export interface LineItem {
  key: string
  label: string
  category: Category
  /** значення в EUR */
  range: Range
  note?: string
  formula?: string
  /** ринкова оцінка, а не офіційна ставка */
  estimate?: boolean
  source?: { title: string; url: string }
}

export interface Nuance {
  id: string
  title: string
  why: string
  required: 'always' | 'likely' | 'sometimes'
  cost: Record<BrandTier, [number, number]>
  howTo?: string
}

export interface CalcResult {
  items: LineItem[]
  nuances: Nuance[]
  warnings: string[]
  checklist: string[]
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
