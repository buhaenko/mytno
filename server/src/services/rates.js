import { env, upstream } from '../config.js'
import { ExchangeRate } from '../models/ExchangeRate.js'

/**
 * Rates from the National Bank of Ukraine, cached in the database.
 * If the bank is unreachable we serve the last good copy, then the file in config/.
 */
export async function getRates(fallback) {
  const cached = await ExchangeRate.findOne({ key: 'nbu' })
  if (cached?.isFresh(env.fxTtlHours)) return { ...toRates(cached), source: 'cache' }

  try {
    const response = await fetch(upstream.nbuRates, { signal: AbortSignal.timeout(upstream.timeoutMs) })
    if (!response.ok) throw new Error(`NBU responded ${response.status}`)

    const list = await response.json()
    const usd = list.find((row) => row.cc === 'USD')
    const eur = list.find((row) => row.cc === 'EUR')
    if (!usd || !eur) throw new Error('NBU response has no USD/EUR')

    const rates = { usdUah: usd.rate, eurUah: eur.rate, date: usd.exchangedate }
    await ExchangeRate.findOneAndUpdate({ key: 'nbu' }, { ...rates, fetchedAt: new Date() }, { upsert: true })
    return { ...rates, source: 'nbu' }
  } catch {
    return cached ? { ...toRates(cached), source: 'stale-cache' } : { ...fallback, source: 'fallback' }
  }
}

const toRates = ({ usdUah, eurUah, date }) => ({ usdUah, eurUah, date })
