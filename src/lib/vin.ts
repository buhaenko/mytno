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

/** Контрольна цифра (позиція 9) — використовується на авто для Північної Америки (і в частини китайських/корейських VIN). */
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
/** Рік моделі за 10-м символом (для VIN з контрольною цифрою — однозначно; інакше орієнтовно). */
export function modelYearFromVin(vin: string): number | undefined {
  const c = vin[9]
  if (!c) return undefined
  const idx = YEAR_CODES.indexOf(c)
  if (idx < 0) return undefined
  // 2001..2030; для 7-ї позиції з літерою — 2010+ (стандарт NHTSA)
  const base = 2001 + idx // '1' → 2001 ... 'Y' → 2030
  const seventhIsLetter = /[A-Z]/.test(vin[6] ?? '')
  if (!seventhIsLetter && base >= 2010) return base - 30 // 1980..2000
  return base
}

export interface WmiInfo {
  region: 'NA' | 'EU' | 'ASIA' | 'OTHER'
  country: string
}

export function wmiInfo(vin: string): WmiInfo {
  const c = vin[0] ?? ''
  if ('12345'.includes(c)) return { region: 'NA', country: c === '2' ? 'Канада' : c === '3' ? 'Мексика' : 'США' }
  if (c === 'J') return { region: 'ASIA', country: 'Японія' }
  if (c === 'K') return { region: 'ASIA', country: 'Корея' }
  if (c === 'L') return { region: 'ASIA', country: 'Китай' }
  if (c === 'M' || c === 'N' || c === 'P' || c === 'R') return { region: 'ASIA', country: 'Азія' }
  if ('STUVWXYZ'.includes(c)) {
    const map: Record<string, string> = { S: 'Велика Британія/Польща', T: 'Чехія/Швейцарія', U: 'Румунія/Словаччина', V: 'Франція/Іспанія', W: 'Німеччина', X: 'Росія/Узбекистан', Y: 'Швеція/Фінляндія/Бельгія', Z: 'Італія' }
    return { region: 'EU', country: map[c] ?? 'Європа' }
  }
  if (c === '9') return { region: 'OTHER', country: 'Бразилія' }
  if ('678'.includes(c)) return { region: 'OTHER', country: 'Океанія/Аргентина' }
  return { region: 'OTHER', country: 'Невідомо' }
}

/**
 * Для якого ринку зроблене авто. Це ключове для омологації в ЄС.
 * Евристика: VW-група ставить ZZZ на 4–6 позиціях для не-американських версій;
 * авто для Північної Америки мають правильну контрольну цифру і завод/ринок NA.
 */
export function detectMarketSpec(vin: string, nhtsaClean: boolean): { spec: MarketSpec; reason: string } {
  const w = wmiInfo(vin)
  const hasZZZ = vin.slice(3, 6) === 'ZZZ'
  const cd = checkDigitValid(vin)
  if (hasZZZ) return { spec: 'EU', reason: 'VIN містить «ZZZ» на позиціях 4–6 — європейська версія (VW Group, не для США).' }
  if (w.region === 'NA') return { spec: 'US', reason: `Виробник зареєстрований у ${w.country} (перший символ «${vin[0]}»).` }
  if (w.region === 'ASIA' && vin[0] === 'J' && !cd) return { spec: 'JP', reason: 'Японський VIN без контрольної цифри — версія для Японії/не-США.' }
  if (w.region === 'ASIA' && vin[0] === 'K' && !cd) return { spec: 'KR', reason: 'Корейський VIN без контрольної цифри — не-американська версія.' }
  if (cd && nhtsaClean) return { spec: 'US', reason: 'Контрольна цифра сходиться і база NHTSA розпізнала комплектацію — версія для ринку США/Канади.' }
  if (w.region === 'EU') return { spec: 'EU', reason: `Європейський виробник (${w.country}), контрольної цифри немає — європейська версія.` }
  if (w.region === 'ASIA') return { spec: 'US', reason: 'Азійський виробник, але VIN з контрольною цифрою — найімовірніше версія для США.' }
  return { spec: 'OTHER', reason: 'Ринок не визначено за VIN — уточніть вручну.' }
}
