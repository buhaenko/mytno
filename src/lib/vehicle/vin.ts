import type { Market } from '../../types'

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
const YEAR_CODES = '123456789ABCDEFGHJKLMNPRSTVWXY'

export const normalizeVin = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const isVin = (vin: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)

/** Position 9 is a checksum on North American VINs; European ones simply do not carry it. */
export function checkDigitValid(vin: string): boolean {
  if (!isVin(vin)) return false
  const sum = [...vin].reduce((acc, ch, i) => acc + (/\d/.test(ch) ? Number(ch) : TRANSLIT[ch] ?? 0) * WEIGHTS[i]!, 0)
  const remainder = sum % 11
  return vin[8] === (remainder === 10 ? 'X' : String(remainder))
}

/** Position 10 is the model year; a letter in position 7 means 2010 or later. */
export function modelYearFromVin(vin: string): number | undefined {
  const index = YEAR_CODES.indexOf(vin[9] ?? '')
  if (index < 0) return undefined
  const year = 2001 + index
  const seventhIsLetter = /[A-Z]/.test(vin[6] ?? '')
  return !seventhIsLetter && year >= 2010 ? year - 30 : year
}

export interface Manufacturer {
  region: 'NA' | 'EU' | 'ASIA' | 'OTHER'
  /** ISO code when the first character names one country, for Intl.DisplayNames. */
  country?: string
  /** A readable fallback when it names several. */
  label: string
}

/** The first VIN character is the world manufacturer region. */
export function manufacturer(vin: string): Manufacturer {
  const c = vin[0] ?? ''
  if ('145'.includes(c)) return { region: 'NA', country: 'US', label: 'US' }
  if (c === '2') return { region: 'NA', country: 'CA', label: 'CA' }
  if (c === '3') return { region: 'NA', country: 'MX', label: 'MX' }
  if (c === 'J') return { region: 'ASIA', country: 'JP', label: 'JP' }
  if (c === 'K') return { region: 'ASIA', country: 'KR', label: 'KR' }
  if (c === 'L') return { region: 'ASIA', country: 'CN', label: 'CN' }
  if ('MNPR'.includes(c)) return { region: 'ASIA', label: 'Asia' }
  if ('STUVWXYZ'.includes(c)) {
    const labels: Record<string, string> = { S: 'GB/PL', T: 'CZ/CH', U: 'RO/SK', V: 'FR/ES', W: 'DE', X: 'RU/UZ', Y: 'SE/FI/BE', Z: 'IT' }
    return { region: 'EU', country: c === 'W' ? 'DE' : c === 'Z' ? 'IT' : undefined, label: labels[c] ?? 'EU' }
  }
  if (c === '9') return { region: 'OTHER', country: 'BR', label: 'BR' }
  return { region: 'OTHER', label: '—' }
}

/**
 * Which market the car was built for — the single most important thing for EU type approval.
 * VW Group writes ZZZ in positions 4–6 on non-US cars; North American cars carry a valid check digit.
 */
export function detectMarket(vin: string, nhtsaDecodedCleanly: boolean): { market: Market; reason: string } {
  const maker = manufacturer(vin)
  if (vin.slice(3, 6) === 'ZZZ') return { market: 'EU', reason: 'specZZZ' }
  if (maker.region === 'NA') return { market: 'US', reason: 'specNA' }

  const hasCheckDigit = checkDigitValid(vin)
  if (maker.region === 'ASIA' && vin[0] === 'J' && !hasCheckDigit) return { market: 'JP', reason: 'specJP' }
  if (maker.region === 'ASIA' && vin[0] === 'K' && !hasCheckDigit) return { market: 'KR', reason: 'specKR' }
  if (hasCheckDigit && nhtsaDecodedCleanly) return { market: 'US', reason: 'specNAcd' }
  if (maker.region === 'EU') return { market: 'EU', reason: 'specEU' }
  if (maker.region === 'ASIA') return { market: 'US', reason: 'specAsiaUS' }
  return { market: 'OTHER', reason: 'specUnknown' }
}
