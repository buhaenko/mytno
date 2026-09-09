import type { Vehicle } from '../types'

/**
 * Estonia is the one country that answers the question itself. Transpordiamet runs the public
 * registration-fee calculator behind an open API which sends `Access-Control-Allow-Origin: *`
 * and asks for no key, so the browser can put the car to the authority rather than reproduce
 * its law — and the law is not readable anyway: riigiteataja.ee serves an empty shell, and the
 * ministry's draft figures do not match what this endpoint returns.
 *
 * It wants a gross mass, which every European registration certificate prints in field F.1
 * and no other country's rules need from us.
 */
const API = 'https://apimsm.transpordiamet.ee/v2/msm/regTasu/by-technical-parameters'

export const ESTONIA_SOURCE = {
  title: 'Transpordiamet — registreerimistasu kalkulaator (transpordiamet.ee)',
  url: 'https://www.transpordiamet.ee/en/motor-vehicle-tax',
}

export interface EstonianFee {
  /** What the register will charge, in euro. */
  total: number
  base: number
  co2: number
  mass: number
  /** How much of the fee the car's age leaves standing. */
  ageCoef: number
}

/** Everything the endpoint needs, or null when the car cannot supply it. */
function query(v: Vehicle, now: Date): URLSearchParams | null {
  const co2 = v.fuel === 'electric' ? 0 : v.co2Wltp
  if (co2 === undefined || !v.grossMassKg) return null
  return new URLSearchParams({
    category: 'M1',
    co2wltp: String(Math.round(co2)),
    technPermMaxLadenMass: String(Math.round(v.grossMassKg)),
    initialRegDate: `${v.year}-07-01`,
    seats: '5',
    regFeeCalcDate: now.toISOString().slice(0, 10),
  })
}

export async function estoniaFee(v: Vehicle, now = new Date()): Promise<EstonianFee | null> {
  const params = query(v, now)
  if (!params) return null

  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`Transpordiamet → ${res.status}`)
  const data = (await res.json()) as Record<string, number>
  if (typeof data.totalPrice !== 'number') throw new Error('Transpordiamet: no amount')

  return {
    total: data.totalPrice,
    base: data.basePrice ?? 0,
    co2: data.co2Price ?? 0,
    mass: data.massPrice ?? 0,
    ageCoef: data.ageCoef ?? 1,
  }
}
