import type { Destination, Estimate, FxRates, Trip, Vehicle } from '../types'

/**
 * The same car, priced in every country that can answer, cheapest first.
 *
 * Dearest first: the number that makes somebody stop is the big one, and putting it at the
 * top means the longest bar anchors the chart instead of trailing off the bottom of it.
 *
 * This is the one thing a calculator that knows thirty-one countries can say and a
 * calculator that knows one cannot, so it belongs on the first screen rather than under a
 * result nobody has asked for yet. A country whose tax cannot be reduced to a number is
 * left out rather than shown cheap — otherwise the chart would recommend exactly the places
 * we know least about.
 *
 * `estimate` is passed in rather than imported: the prerender runs the calculator bundled
 * for Node, the app runs it in the browser, and handing the same function to the same code
 * is what stops the two from ever quoting different figures.
 */
export type SpreadRow = { code: Destination; total: number; share: number }

export function spread(
  estimate: (v: Vehicle, t: Trip, fx: FxRates) => Estimate,
  vehicle: Vehicle,
  trip: Omit<Trip, 'destination'>,
  destinations: Destination[],
  fx: FxRates,
): SpreadRow[] {
  const rows = destinations
    .map((code) => {
      const result = estimate(vehicle, { ...trip, destination: code }, fx)
      const regTax = result.lines.find((line) => line.id === 'regTax')
      return { code, total: result.total.likely, unknown: !!regTax?.unknown }
    })
    // A zero stays in: for a used car within the EU there is no duty and no VAT, so a country
    // with no registration tax really does cost nothing, and that is the most quotable row here.
    .filter((row) => !row.unknown)
    .sort((a, b) => b.total - a.total)

  const most = rows[0]?.total ?? 1
  return rows.map(({ code, total }) => ({ code, total, share: total / most }))
}

/**
 * One order for a whole rotation of cars: what each country charges on average, dearest
 * first. The home page keeps this order while the car changes, so only the bars move — see
 * the note in HomeSpread for why reordering every car was the wrong answer.
 */
export function averageOrder(ladders: SpreadRow[][]): Destination[] {
  const sum = new Map<Destination, number>()
  for (const ladder of ladders) {
    for (const row of ladder) sum.set(row.code, (sum.get(row.code) ?? 0) + row.total)
  }
  return [...sum.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code)
}
