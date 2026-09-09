import type { FxRates } from '../types'
import fallback from '@config/fx.fallback.json'
import { api, hasApi } from './api'

const NBU = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'

/** Rates come from our API (cached there) or straight from the National Bank; the file is the last resort. */
export async function loadFx(): Promise<FxRates> {
  if (hasApi) {
    try {
      const r = await api<{ usdUah: number; eurUah: number; date: string }>('/api/fx')
      return { ...r, source: 'nbu' }
    } catch { /* fall through to the direct call */ }
  }
  try {
    const res = await fetch(NBU, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(String(res.status))
    const list = (await res.json()) as { cc: string; rate: number; exchangedate: string }[]
    const usd = list.find((x) => x.cc === 'USD')
    const eur = list.find((x) => x.cc === 'EUR')
    if (!usd || !eur) throw new Error('no rates')
    return { usdUah: usd.rate, eurUah: eur.rate, date: usd.exchangedate, source: 'nbu' }
  } catch {
    return { ...fallback, source: 'fallback' }
  }
}

export function toEur(amount: number, cur: 'EUR' | 'USD' | 'UAH', fx: FxRates): number {
  if (cur === 'EUR') return amount
  if (cur === 'USD') return (amount * fx.usdUah) / fx.eurUah
  return amount / fx.eurUah
}

export function fromEur(amountEur: number, cur: 'EUR' | 'USD' | 'UAH', fx: FxRates): number {
  if (cur === 'EUR') return amountEur
  if (cur === 'USD') return (amountEur * fx.eurUah) / fx.usdUah
  return amountEur * fx.eurUah
}
