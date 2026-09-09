import type { Currency, Destination, Trip, Vehicle } from '../types'
import type { Locale } from '../i18n'
import { ORIGIN_GROUP } from '../lib/origins'
import { tierForMake } from '../lib/vehicle/reference'

/**
 * Everything the app needs to reproduce a screen, in one plain object.
 * It is what a share code stores and what the address bar carries.
 */
export interface Snapshot {
  vehicle: Vehicle
  trip: Trip
  /** The country the car is bought in; the trip only keeps its customs group. */
  originCountry: string | null
  locale: Locale
}

export const blankVehicle = (): Vehicle => ({
  make: '', model: '', year: new Date().getFullYear() - 5, fuel: 'petrol', market: 'US', brandTier: 'mass', notes: [],
})

/** Short keys keep the fallback link short when there is no backend. */
type Wire = { v: Vehicle; r: Trip; oc: string | null; l: Locale }

export const toWire = (s: Snapshot): Wire => ({ v: { ...s.vehicle, notes: [] }, r: s.trip, oc: s.originCountry, l: s.locale })

export function fromWire(w: Partial<Wire>): Partial<Snapshot> | null {
  if (!w.v || !w.r) return null
  return {
    vehicle: { ...blankVehicle(), ...w.v },
    trip: w.r,
    originCountry: w.oc ?? (w.r.origin === 'EU' ? 'DE' : w.r.origin === 'OTHER' ? 'GB' : w.r.origin),
    locale: w.l,
  }
}

/** The readable form: `?from=LT&to=ES&vin=…&price=…`. Only what differs from the defaults is written. */
export function toQuery(s: Snapshot): string {
  const q = new URLSearchParams()
  const put = (key: string, value: string | number | undefined | null) => { if (value) q.set(key, String(value)) }
  const v = s.vehicle

  put('from', s.originCountry)
  put('to', s.trip.destination)
  put('vin', v.vin)
  if (v.make) {
    put('make', v.make); put('model', v.model); put('year', v.year); put('fuel', v.fuel); put('market', v.market)
  }
  put('cc', v.engineCc); put('kwh', v.batteryKwh); put('co2', v.co2Wltp); put('lp', v.listPriceEur)
  put('hp', v.powerHp); put('plant', v.plantCountry)
  if (s.trip.price) { put('price', s.trip.price); put('cur', s.trip.currency) }
  if (!s.trip.hasOriginProof) q.set('proof', '0')
  if (s.trip.residenceTransfer) q.set('reloc', '1')

  const query = q.toString()
  return query ? `?${query}` : ''
}

export function fromQuery(q: URLSearchParams, destinations: readonly string[]): Partial<Snapshot> {
  const num = (key: string) => {
    const n = Number(q.get(key))
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const from = q.get('from')
  const to = q.get('to')

  const vehicle: Vehicle = {
    ...blankVehicle(),
    vin: q.get('vin') ?? undefined,
    make: q.get('make') ?? '',
    model: q.get('model') ?? '',
    year: num('year') ?? blankVehicle().year,
    fuel: (q.get('fuel') as Vehicle['fuel']) ?? 'petrol',
    market: (q.get('market') as Vehicle['market']) ?? 'US',
    engineCc: num('cc'),
    batteryKwh: num('kwh'),
    co2Wltp: num('co2'),
    listPriceEur: num('lp'),
    powerHp: num('hp'),
    plantCountry: q.get('plant') ?? undefined,
    notes: [],
  }
  if (vehicle.make) vehicle.brandTier = tierForMake(vehicle.make)

  const currency = q.get('cur')
  return {
    originCountry: from && ORIGIN_GROUP[from] ? from : null,
    vehicle: vehicle.vin || vehicle.make ? vehicle : undefined,
    trip: {
      origin: from && ORIGIN_GROUP[from] ? ORIGIN_GROUP[from] : 'US',
      destination: (to && destinations.includes(to) ? to : 'UA') as Destination,
      price: num('price') ?? 0,
      currency: (currency === 'USD' || currency === 'EUR' || currency === 'UAH' ? currency : 'EUR') as Currency,
      hasOriginProof: q.get('proof') !== '0',
      residenceTransfer: q.get('reloc') === '1',
    },
  } as Partial<Snapshot>
}
