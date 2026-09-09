import type { Currency, FxRates, Quote } from '../types'
import fallback from '@config/fx.fallback.json'

/**
 * Every amount is held in euro, so each rate says what one euro buys. The dollar
 * comes from the European Central Bank and the hryvnia from the National Bank of
 * Ukraine — each currency from the institution that publishes it, never derived
 * through a third one. Both answer the browser directly; either can fall back to
 * the bundled snapshot on its own.
 */
const ECB = 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=csvdata'
const NBU = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'

const held = (quote: { rate: number; date: string }): Quote => ({ ...quote, source: 'fallback' })

export const fallbackRates = (): FxRates => ({ usd: held(fallback.usd), uah: held(fallback.uah) })

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return (await res.json()) as T
}

/** SDMX-CSV: one header line, one observation. The columns we read all precede the quoted ones. */
async function ecbUsd(): Promise<Quote> {
  const res = await fetch(ECB, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`ECB ${res.status}`)
  const [header, row] = (await res.text()).trim().split('\n')
  const columns = header!.split(',')
  const field = (name: string) => row!.split(',')[columns.indexOf(name)]
  const rate = Number(field('OBS_VALUE'))
  const date = field('TIME_PERIOD')
  if (!rate || !date) throw new Error('ECB: no observation')
  return { rate, date, source: 'ecb' }
}

/** The National Bank dates its rates day.month.year. */
async function nbuUah(): Promise<Quote> {
  const list = await json<{ cc: string; rate: number; exchangedate: string }[]>(NBU)
  const eur = list.find((x) => x.cc === 'EUR')
  if (!eur?.rate) throw new Error('NBU: no euro rate')
  const [day, month, year] = eur.exchangedate.split('.')
  return { rate: eur.rate, date: `${year}-${month}-${day}`, source: 'nbu' }
}

export async function loadFx(): Promise<FxRates> {
  const [usd, uah] = await Promise.all([
    ecbUsd().catch(() => held(fallback.usd)),
    nbuUah().catch(() => held(fallback.uah)),
  ])
  return { usd, uah }
}

const per = (cur: Currency, fx: FxRates) => (cur === 'USD' ? fx.usd.rate : fx.uah.rate)

export const toEur = (amount: number, cur: Currency, fx: FxRates): number =>
  cur === 'EUR' ? amount : amount / per(cur, fx)

export const fromEur = (amountEur: number, cur: Currency, fx: FxRates): number =>
  cur === 'EUR' ? amountEur : amountEur * per(cur, fx)
