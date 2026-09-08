import type { MarketSpec } from '../types'

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidVinFormat(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)
}

/** Check digit (position 9) — used on North American vehicles (and some Chinese/Korean VINs). */
export function checkDigitValid(vin: string): boolean {
  if (!isValidVinFormat(vin)) return false
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const ch = vin[i]!
    const v = /\d/.test(ch) ? Number(ch) : TRANSLIT[ch] ?? 0
    sum += v * WEIGHTS[i]!
  }
  const rem = sum % 11
  const expected = rem === 10 ? 'X' : String(rem)
  return vin[8] === expected
}

const YEAR_CODES = '123456789ABCDEFGHJKLMNPRSTVWXY'
/** Model year from the 10th character (exact for VINs with a check digit, approximate otherwise). */
export function modelYearFromVin(vin: string): number | undefined {
  const c = vin[9]
  if (!c) return undefined
  const idx = YEAR_CODES.indexOf(c)
  if (idx < 0) return undefined
  // 2001..2030; a letter in position 7 means 2010+ (NHTSA rule)
  const base = 2001 + idx // '1' → 2001 ... 'Y' → 2030
  const seventhIsLetter = /[A-Z]/.test(vin[6] ?? '')
  if (!seventhIsLetter && base >= 2010) return base - 30 // 1980..2000
  return base
}

export interface WmiInfo {
  region: 'NA' | 'EU' | 'ASIA' | 'OTHER'
  /** ISO country code (for Intl.DisplayNames) when unambiguous */
  countryKey?: string
  /** fallback label when the code is ambiguous */
  country: string
}

export function wmiInfo(vin: string): WmiInfo {
  const c = vin[0] ?? ''
  if ('145'.includes(c)) return { region: 'NA', countryKey: 'US', country: 'US' }
  if (c === '2') return { region: 'NA', countryKey: 'CA', country: 'CA' }
  if (c === '3') return { region: 'NA', countryKey: 'MX', country: 'MX' }
  if (c === 'J') return { region: 'ASIA', countryKey: 'JP', country: 'JP' }
  if (c === 'K') return { region: 'ASIA', countryKey: 'KR', country: 'KR' }
  if (c === 'L') return { region: 'ASIA', countryKey: 'CN', country: 'CN' }
  if (c === 'M' || c === 'N' || c === 'P' || c === 'R') return { region: 'ASIA', country: 'Asia' }
  if ('STUVWXYZ'.includes(c)) {
    const map: Record<string, string> = { S: 'GB/PL', T: 'CZ/CH', U: 'RO/SK', V: 'FR/ES', W: 'DE', X: 'RU/UZ', Y: 'SE/FI/BE', Z: 'IT' }
    const key = c === 'W' ? 'DE' : c === 'Z' ? 'IT' : undefined
    return { region: 'EU', countryKey: key, country: map[c] ?? 'EU' }
  }
  if (c === '9') return { region: 'OTHER', countryKey: 'BR', country: 'BR' }
  return { region: 'OTHER', country: '—' }
}

/**
 * Which market the car was built for — decisive for EU type approval.
 * Heuristic: VW Group uses ZZZ in positions 4–6 on non-US versions;
 * North American cars carry a valid check digit and an NA manufacturer.
 */
export function detectMarketSpec(vin: string, nhtsaClean: boolean): { spec: MarketSpec; reasonKey: string } {
  const w = wmiInfo(vin)
  const hasZZZ = vin.slice(3, 6) === 'ZZZ'
  const cd = checkDigitValid(vin)
  if (hasZZZ) return { spec: 'EU', reasonKey: 'specZZZ' }
  if (w.region === 'NA') return { spec: 'US', reasonKey: 'specNA' }
  if (w.region === 'ASIA' && vin[0] === 'J' && !cd) return { spec: 'JP', reasonKey: 'specJP' }
  if (w.region === 'ASIA' && vin[0] === 'K' && !cd) return { spec: 'KR', reasonKey: 'specKR' }
  if (cd && nhtsaClean) return { spec: 'US', reasonKey: 'specNAcd' }
  if (w.region === 'EU') return { spec: 'EU', reasonKey: 'specEU' }
  if (w.region === 'ASIA') return { spec: 'US', reasonKey: 'specAsiaUS' }
  return { spec: 'OTHER', reasonKey: 'specUnknown' }
}
