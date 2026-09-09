import { upstream } from '../config.js'
import { VinDecode } from '../models/VinDecode.js'

/** Decode through NHTSA once, then serve it from our database for good. */
export async function decodeVin(vin) {
  const cached = await VinDecode.findOne({ vin }).lean()
  if (cached) return { ...cached.data, source: 'cache' }

  const response = await fetch(upstream.nhtsaDecode(vin), { signal: AbortSignal.timeout(upstream.timeoutMs) })
  if (!response.ok) throw new Error(`NHTSA responded ${response.status}`)

  const data = (await response.json())?.Results?.[0]
  if (!data) throw new Error('NHTSA returned no result')

  await VinDecode.findOneAndUpdate({ vin }, { vin, data, fetchedAt: new Date() }, { upsert: true })
  return { ...data, source: 'nhtsa' }
}
