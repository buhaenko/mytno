// Exchange rates from the National Bank of Ukraine, cached in the database.
// If the bank is unreachable we serve the last good copy, then the file in config/.
import { env, upstream } from '../config.js'
import { fx } from '../store/mongo.js'

export async function getRates(fallback) {
  const cached = await fx().findOne({ key: 'nbu' })
  const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < env.fxTtlHours * 3600_000
  if (fresh) return { ...cached.rates, source: 'cache' }

  try {
    const res = await fetch(upstream.nbuRates, { signal: AbortSignal.timeout(upstream.timeoutMs) })
    if (!res.ok) throw new Error(`NBU ${res.status}`)
    const list = await res.json()
    const usd = list.find((x) => x.cc === 'USD')
    const eur = list.find((x) => x.cc === 'EUR')
    if (!usd || !eur) throw new Error('NBU response has no USD/EUR')
    const rates = { usdUah: usd.rate, eurUah: eur.rate, date: usd.exchangedate }
    await fx().updateOne({ key: 'nbu' }, { $set: { key: 'nbu', rates, fetchedAt: new Date() } }, { upsert: true })
    return { ...rates, source: 'nbu' }
  } catch {
    if (cached) return { ...cached.rates, source: 'stale-cache' }
    return { ...fallback, source: 'fallback' }
  }
}
