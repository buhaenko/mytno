import type { CalcResult, FxRates, RouteInput, Vehicle } from '../../types'
import { calcSpain } from './spain'
import { calcUkraine } from './ukraine'

export function calculate(v: Vehicle, i: RouteInput, fx: FxRates): CalcResult {
  return i.destination === 'UA' ? calcUkraine(v, i, fx) : calcSpain(v, i, fx)
}
