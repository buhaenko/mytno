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
  /** Є EUR.1 / декларація походження (авто зроблене в ЄС і куплене в ЄС) */
  hasOriginProof: boolean
  /** Іспанія: пільга при переїзді (traslado de residencia) */
  residenceTransfer: boolean
}

export type Range = { min: number; likely: number; max: number }
export type Category = 'tax' | 'fees'

/** Повідомлення для перекладу: ключ + параметри */
export interface Msg { key: string; params?: Record<string, string | number> }

export interface LineItem {
  key: string
  label: Msg
  category: Category
  /** значення в EUR */
  range: Range
  note?: Msg
  formula?: string
  /** ринкова оцінка, а не офіційна ставка */
  estimate?: boolean
  source?: { title: string; url: string }
}

export interface Nuance {
  id: string
  required: 'always' | 'likely' | 'sometimes'
  cost: Record<BrandTier, [number, number]>
}
export interface CountryInfo { eu: boolean; vat: number; registration: 'computed' | 'none' | 'external'; customs: string }

export interface NotComputed { key: string; source: { title: string; url: string } }

export interface CalcResult {
  items: LineItem[]
  /** платежі, які існують у країні, але не рахуються тут (посилання на офіційне джерело) */
  notComputed: NotComputed[]
  nuances: Nuance[]
  warnings: Msg[]
  checklist: Msg[]
  /** обов'язкове переобладнання (входить у суму) */
  conversionTotal: Range
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
