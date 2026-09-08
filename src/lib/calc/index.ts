import type { CalcResult, FxRates, RouteInput, Vehicle } from '../../types'
import { calcSpain } from './spain'
import { calcUkraine } from './ukraine'
import { calcEu } from './eu'

export function calculate(v: Vehicle, i: RouteInput, fx: FxRates): CalcResult {
  if (i.destination === 'UA') return calcUkraine(v, i, fx)
  if (i.destination === 'ES') return calcSpain(v, i, fx)
  return calcEu(v, i, fx)
}
