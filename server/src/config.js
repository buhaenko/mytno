// Every runtime setting in one place. Nothing else reads process.env.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(here, '../..')
export const CONFIG_DIR = join(ROOT, 'config')

export const env = {
  port: Number(process.env.PORT ?? 8787),
  /** Set to use a real MongoDB. Empty in local dev: an embedded MongoDB is started instead. */
  mongoUrl: process.env.MONGO_URL ?? '',
  dbName: process.env.MONGO_DB ?? 'vinta',
  /** Where the embedded dev database keeps its files. */
  localDbPath: process.env.LOCAL_DB_PATH ?? join(ROOT, 'server/.data/mongo'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  /** How long a cached National Bank rate stays fresh. */
  fxTtlHours: Number(process.env.FX_TTL_HOURS ?? 6),
  /** A VIN decode never changes, so it is cached for a long time. */
  vinTtlDays: Number(process.env.VIN_TTL_DAYS ?? 365),
  shareTtlDays: Number(process.env.SHARE_TTL_DAYS ?? 730),
  shareMaxBytes: Number(process.env.SHARE_MAX_BYTES ?? 4096),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60),
}

/** External services. Each one is optional: the API falls back to config/ files or a cached copy. */
export const upstream = {
  nbuRates: 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json',
  nhtsaDecode: (vin) => `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
  timeoutMs: 8000,
}

/** The tax rules, sources and reference data — plain JSON files, editable without a deploy. */
export function loadRuleFiles() {
  const files = readdirSync(CONFIG_DIR).filter((f) => f.endsWith('.json'))
  const out = {}
  for (const f of files) out[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(CONFIG_DIR, f), 'utf8'))
  return out
}
