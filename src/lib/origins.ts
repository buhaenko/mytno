import type { Origin } from '../types'
import data from '@config/origins.json'

/** Country of purchase → the customs rules that apply (see config/origins.json). */
export const ORIGIN_COUNTRIES = data.countries as { code: string; group: Origin }[]
export const ORIGIN_GROUP: Record<string, Origin> = Object.fromEntries(ORIGIN_COUNTRIES.map((c) => [c.code, c.group]))
