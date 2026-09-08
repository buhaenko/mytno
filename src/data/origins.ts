import type { Origin } from '../types'

/** Країна покупки → група митних правил. ЄС-27 → 'EU'; Північна Америка → 'US'; решта → відповідна група або 'OTHER'. */
export const ORIGIN_COUNTRIES: { code: string; group: Origin }[] = [
  { code: 'US', group: 'US' }, { code: 'CA', group: 'US' }, { code: 'MX', group: 'US' },
  { code: 'DE', group: 'EU' }, { code: 'PL', group: 'EU' }, { code: 'LT', group: 'EU' }, { code: 'NL', group: 'EU' }, { code: 'BE', group: 'EU' }, { code: 'FR', group: 'EU' },
  { code: 'IT', group: 'EU' }, { code: 'ES', group: 'EU' }, { code: 'AT', group: 'EU' }, { code: 'CZ', group: 'EU' }, { code: 'SK', group: 'EU' }, { code: 'HU', group: 'EU' },
  { code: 'RO', group: 'EU' }, { code: 'BG', group: 'EU' }, { code: 'HR', group: 'EU' }, { code: 'SI', group: 'EU' }, { code: 'LV', group: 'EU' }, { code: 'EE', group: 'EU' },
  { code: 'FI', group: 'EU' }, { code: 'SE', group: 'EU' }, { code: 'DK', group: 'EU' }, { code: 'IE', group: 'EU' }, { code: 'PT', group: 'EU' }, { code: 'GR', group: 'EU' },
  { code: 'CY', group: 'EU' }, { code: 'MT', group: 'EU' }, { code: 'LU', group: 'EU' },
  { code: 'UA', group: 'UA' }, { code: 'JP', group: 'JP' }, { code: 'KR', group: 'KR' },
  { code: 'GB', group: 'OTHER' }, { code: 'CH', group: 'OTHER' }, { code: 'NO', group: 'OTHER' }, { code: 'GE', group: 'OTHER' }, { code: 'AE', group: 'OTHER' },
  { code: 'CN', group: 'OTHER' }, { code: 'TR', group: 'OTHER' }, { code: 'MD', group: 'OTHER' }, { code: 'RS', group: 'OTHER' }, { code: 'AU', group: 'OTHER' },
]
export const ORIGIN_GROUP: Record<string, Origin> = Object.fromEntries(ORIGIN_COUNTRIES.map((c) => [c.code, c.group]))
