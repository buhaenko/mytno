import type { FxRates } from '../types'
import fallback from '../data/fx.fallback.json'

const NBU = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'

export async function loadFx(): Promise<FxRates> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(NBU, { signal: ctrl.signal })
    clearTimeout(t)
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
