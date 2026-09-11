import type { Estimate, FxRates, Trip, Vehicle } from '../../types'
import type { EstonianFee } from '../estonia'
import { estimateEu } from './eu'
import { estimateSpain } from './spain'
import { estimateNorway } from './norway'
import { estimateUnitedKingdom } from './uk'
import { estimateSwitzerland } from './switzerland'
import { estimateUkraine } from './ukraine'

/** One entry point: the destination decides which set of rules applies. */
export function estimate(vehicle: Vehicle, trip: Trip, fx: FxRates, estonia?: EstonianFee | null): Estimate {
  const result = byDestination(vehicle, trip, fx, estonia)
  // Said once, wherever the car came from: a CO₂ figure filled in from the American cycle
  // is a real measurement from the wrong test, and every tax that reads it inherits that.
  if (vehicle.co2Source === 'epa') {
    return { ...result, warnings: [...result.warnings, { key: 'warn.co2FromEpa', params: { co2: vehicle.co2Wltp ?? 0 } }] }
  }
  return result
}

function byDestination(vehicle: Vehicle, trip: Trip, fx: FxRates, estonia?: EstonianFee | null): Estimate {
  if (trip.destination === 'UA') return estimateUkraine(vehicle, trip, fx)
  if (trip.destination === 'ES') return estimateSpain(vehicle, trip, fx)
  if (trip.destination === 'CH') return estimateSwitzerland(vehicle, trip, fx)
  if (trip.destination === 'NO') return estimateNorway(vehicle, trip, fx)
  if (trip.destination === 'GB') return estimateUnitedKingdom(vehicle, trip, fx)
  return estimateEu(vehicle, trip, fx, undefined, estonia)
}
