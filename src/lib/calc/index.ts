import type { Estimate, FxRates, Trip, Vehicle } from '../../types'
import { estimateEu } from './eu'
import { estimateSpain } from './spain'
import { estimateUkraine } from './ukraine'

/** One entry point: the destination decides which set of rules applies. */
export function estimate(vehicle: Vehicle, trip: Trip, fx: FxRates): Estimate {
  if (trip.destination === 'UA') return estimateUkraine(vehicle, trip, fx)
  if (trip.destination === 'ES') return estimateSpain(vehicle, trip, fx)
  return estimateEu(vehicle, trip, fx)
}
