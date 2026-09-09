// VIN decoding through the NHTSA vPIC database, cached for good.
// A decoded VIN never changes, so repeat lookups never leave our database.
import { upstream } from '../config.js'
import { vins } from '../store/mongo.js'

export async function decodeVin(vin) {
  const cached = await vins().findOne({ vin })
  if (cached) return { ...cached.data, source: 'cache' }

  const res = await fetch(upstream.nhtsaDecode(vin), { signal: AbortSignal.timeout(upstream.timeoutMs) })
  if (!res.ok) throw new Error(`NHTSA ${res.status}`)
  const json = await res.json()
  const data = json?.Results?.[0]
  if (!data) throw new Error('NHTSA returned no result')
  await vins().updateOne({ vin }, { $set: { vin, data, fetchedAt: new Date() } }, { upsert: true })
  return { ...data, source: 'nhtsa' }
}
