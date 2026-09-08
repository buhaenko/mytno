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
  /** Ціна нового в Іспанії (для бази impuesto de matriculación) */
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
  boughtFrom: 'auction' | 'dealer' | 'private'
  /** Є EUR.1 / декларація походження (авто зроблене в ЄС і куплене в ЄС) */
  hasOriginProof: boolean
  /** Іспанія: пільга при переїзді (traslado de residencia) */
  residenceTransfer: boolean
  /** Іспанія: авто «нове» для ПДВ (< 6 міс або < 6000 км) */
  salvage: boolean
  repairBudget: number
  delivery: 'auto' | 'self'
  /** США: штат близько до порту (east coast) чи далеко */
  usInland: 'near' | 'far'
}

export type Range = { min: number; likely: number; max: number }

export type Category = 'tax' | 'logistics' | 'compliance' | 'fees' | 'repair'

export interface LineItem {
  key: string
  label: string
  category: Category
  /** значення в EUR */
  range: Range
  note?: string
  formula?: string
  /** true, якщо це прогноз/оцінка, а не фіксована ставка */
  estimate?: boolean
  /** офіційне джерело ставки */
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
  /** UAH за 1 USD */
  usdUah: number
  /** UAH за 1 EUR */
  eurUah: number
  /** дата курсу */
  date: string
  source: 'nbu' | 'fallback'
}
