import type { Currency, Foreign, FxRates, Quote } from '../types'
import fallback from '@config/fx.fallback.json'

/**
 * Every amount is held in euro, so each rate says how much of a currency one euro
 * buys — and each comes from the bank that publishes it where that bank answers a
 * browser: the zloty from Narodowy Bank Polski, the krone from Norges Bank, the
 * hryvnia from the National Bank of Ukraine. The Swiss National Bank, the Bank of
 * England, ČNB, Riksbank, MNB and BNR serve nothing cross-origin, so their
 * currencies come from the ECB reference rate — which is an official source for
 * all of them, and the only one the browser can read. Every bank is asked in
 * parallel and falls back to the bundled snapshot on its own.
 */
const ECB_SERIES = 'USD+GBP+CHF+CZK+SEK+DKK+HUF+RON+JPY+KRW+CNY+AUD+CAD+MXN+TRY'
const ECB = `https://data-api.ecb.europa.eu/service/data/EXR/D.${ECB_SERIES}.EUR.SP00.A?lastNObservations=1&format=csvdata`
const NBP = 'https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json'
const NORGES = 'https://data.norges-bank.no/api/data/EXR/B.EUR.NOK.SP?lastNObservations=1&format=csv'
const NBU = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'

const { _note, ...snapshot } = fallback
const held = (code: Foreign): Quote => ({ ...snapshot[code], source: 'fallback' })

export const fallbackRates = (): FxRates =>
  Object.fromEntries((Object.keys(snapshot) as Foreign[]).map((c) => [c, held(c)])) as FxRates

async function text(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

/** SDMX-CSV: a header line and one observation per currency. */
async function ecb(): Promise<Partial<Record<Foreign, Quote>>> {
  const [header, ...rows] = (await text(ECB)).trim().split('\n')
  const columns = header!.split(',')
  const at = (row: string, name: string) => row.split(',')[columns.indexOf(name)]!
  const quotes: Partial<Record<Foreign, Quote>> = {}
  for (const row of rows) {
    const code = at(row, 'CURRENCY') as Foreign
    const rate = Number(at(row, 'OBS_VALUE'))
    const date = at(row, 'TIME_PERIOD')
    if (rate && date) quotes[code] = { rate, date, source: 'ecb' }
  }
  if (!quotes.USD) throw new Error('ECB: no observation')
  return quotes
}

/** Narodowy Bank Polski publishes the zloty per euro in table A. */
async function nbp(): Promise<Quote> {
  const data = JSON.parse(await text(NBP)) as { rates: { mid: number; effectiveDate: string }[] }
  const day = data.rates?.[0]
  if (!day?.mid) throw new Error('NBP: no rate')
  return { rate: day.mid, date: day.effectiveDate, source: 'nbp' }
}

/** Norges Bank answers in semicolon-separated CSV, the observation last. */
async function norges(): Promise<Quote> {
  const [, row] = (await text(NORGES)).trim().split('\n')
  const fields = row!.split(';')
  const rate = Number(fields.at(-1))
  const date = fields.at(-2)
  if (!rate || !date) throw new Error('Norges Bank: no observation')
  return { rate, date, source: 'norges' }
}

/** The National Bank of Ukraine dates its rates day.month.year. */
async function nbu(): Promise<Quote> {
  const list = JSON.parse(await text(NBU)) as { cc: string; rate: number; exchangedate: string }[]
  const eur = list.find((x) => x.cc === 'EUR')
  if (!eur?.rate) throw new Error('NBU: no euro rate')
  const [day, month, year] = eur.exchangedate.split('.')
  return { rate: eur.rate, date: `${year}-${month}-${day}`, source: 'nbu' }
}

export async function loadFx(): Promise<FxRates> {
  const [reference, zloty, krone, hryvnia] = await Promise.all([
    ecb().catch(() => ({}) as Partial<Record<Foreign, Quote>>),
    nbp().catch(() => held('PLN')),
    norges().catch(() => held('NOK')),
    nbu().catch(() => held('UAH')),
  ])
  return {
    ...fallbackRates(),
    ...reference,
    PLN: zloty,
    NOK: krone,
    UAH: hryvnia,
  }
}

const per = (cur: Foreign, fx: FxRates) => fx[cur].rate

export const toEur = (amount: number, cur: Currency, fx: FxRates): number =>
  cur === 'EUR' ? amount : amount / per(cur, fx)

export const fromEur = (amountEur: number, cur: Currency, fx: FxRates): number =>
  cur === 'EUR' ? amountEur : amountEur * per(cur, fx)
