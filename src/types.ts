/** The vocabulary the whole app speaks: the car, the trip, and the estimate it produces. */

export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'electric' | 'lpg'
export type Market = 'US' | 'EU' | 'JP' | 'KR' | 'OTHER'
export type BrandTier = 'mass' | 'premium' | 'luxury'
export type Origin = 'US' | 'EU' | 'UA' | 'JP' | 'KR' | 'OTHER'
/** Where a car can be registered. Ukraine, the EU-27, and the three European countries outside it. */
export type Destination =
  | 'UA' | 'ES' | 'PL' | 'DE' | 'AT' | 'BE' | 'BG' | 'HR' | 'CY' | 'CZ' | 'DK' | 'EE' | 'FI' | 'FR'
  | 'GR' | 'HU' | 'IE' | 'IT' | 'LV' | 'LT' | 'LU' | 'MT' | 'NL' | 'PT' | 'RO' | 'SK' | 'SI' | 'SE'
  | 'CH'
export type Currency =
  | 'EUR'
  | 'USD'
  | 'GBP'
  | 'CHF'
  | 'PLN'
  | 'CZK'
  | 'SEK'
  | 'DKK'
  | 'NOK'
  | 'HUF'
  | 'RON'
  | 'UAH'
  | 'JPY'
  | 'KRW'
  | 'CNY'
  | 'AUD'
  | 'CAD'
  | 'MXN'
  | 'TRY'
/** Everything is held in euro, so every other currency is a rate away from it. */
export type Foreign = Exclude<Currency, 'EUR'>
/** The order they are offered in: the euro first, then by how often a car is paid in them. */
export const CURRENCIES: readonly Currency[] = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'SEK', 'DKK', 'NOK', 'HUF', 'RON', 'UAH', 'JPY', 'KRW', 'CNY', 'AUD', 'CAD', 'MXN', 'TRY']

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
  /**
   * Month of first registration, 1–12, field B of a European registration certificate.
   * Five of the tables are monthly — the Dutch, French, Hungarian, Flemish and Croatian —
   * and without it the year alone is worth up to six months of depreciation either way.
   */
  regMonth?: number
  /** Which market the car was built for — it decides whether EU type approval is needed. */
  market: Market
  brandTier: BrandTier
  engineCc?: number
  batteryKwh?: number
  powerHp?: number
  co2Wltp?: number
  /** Gross mass in kilograms, field F.1 of a European registration certificate: the Estonian fee needs it. */
  grossMassKg?: number
  /**
   * Mass in running order, field G of a European registration certificate — the car as it
   * stands, not what it may weigh loaded. Norway charges its whole registration tax on it,
   * the French weight malus is a scale of it, and the Swiss CO₂ target is a line through it.
   */
  kerbMassKg?: number
  /** Overall length in millimetres: half of the Maltese tax is charged on it. */
  lengthMm?: number
  /** List price when new, in the destination country: the base of the Spanish registration tax. */
  listPriceEur?: number
  mileageKm?: number
  plantCountry?: string
  drive?: string
  /** What the VIN decode and the catalogue had to say, shown behind the “?” next to the car. */
  notes: Msg[]
}

export type BelgianRegion = 'FL' | 'WA' | 'BR'

export interface Trip {
  origin: Origin
  destination: Destination
  price: number
  currency: Currency
  /** Belgium taxes by the owner's own region, so nothing can be said until it is named. */
  region?: BelgianRegion
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
  /** Said in red beside the line: the amount rests on an assumption the reader has to weigh. */
  caution?: Msg
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

/** One published rate: what a euro buys, who published it and for which day. */
export interface Quote {
  rate: number
  date: string
  /** The bank that published it — a key in `countries.json` → `fxSources`. */
  source: 'ecb' | 'nbu' | 'nbp' | 'norges' | 'fallback'
}

/** Each currency from the bank that publishes it, never through a cross rate. */
export type FxRates = Record<Foreign, Quote>

export interface CountryInfo {
  eu: boolean
  vat: number
  regTax: 'computed' | 'estimated' | 'api' | 'regional' | 'none' | 'national'
  customs: string
}
