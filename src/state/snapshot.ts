import type { Currency, Destination, Trip, Vehicle } from '../types'
import { CURRENCIES } from '../types'
import type { Locale } from '../i18n'
import { ORIGIN_GROUP } from '../lib/origins'
import { tierForMake } from '../lib/vehicle/reference'

/**
 * Everything the app needs to reproduce a screen, in one plain object.
 * It becomes the query string in the address bar, and nothing else.
 */
export interface Snapshot {
  vehicle: Vehicle
  trip: Trip
  /** The country the car is bought in; the trip only keeps its customs group. */
  originCountry: string | null
  /** The currency the total is read in, which is not necessarily the one it was paid in. */
  display: Currency
  locale: Locale
}

/** What a query string restores. Nothing is assumed: an empty query picks nothing. */
export interface Restored {
  vehicle?: Vehicle
  originCountry: string | null
  destination: Destination | null
  price: number
  currency: Currency
  display: Currency
  hasOriginProof: boolean
  residenceTransfer: boolean
}

export const blankVehicle = (): Vehicle => ({
  make: '', model: '', year: new Date().getFullYear() - 5, fuel: 'petrol', market: 'US', brandTier: 'mass', notes: [],
})


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
  put('price', s.trip.price); put('cur', s.trip.currency); put('show', s.display)
  if (!s.trip.hasOriginProof) q.set('proof', '0')
  if (s.trip.residenceTransfer) q.set('reloc', '1')

  const query = q.toString()
  return query ? `?${query}` : ''
}

export function fromQuery(q: URLSearchParams, destinations: readonly string[]): Restored {
  const num = (key: string) => {
    const n = Number(q.get(key))
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const currency = (key: string, fallback: Currency): Currency => {
    const value = q.get(key) as Currency | null
    return value && CURRENCIES.includes(value) ? value : fallback
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

  return {
    originCountry: from && ORIGIN_GROUP[from] ? from : null,
    destination: to && destinations.includes(to) ? (to as Destination) : null,
    vehicle: vehicle.vin || vehicle.make ? vehicle : undefined,
    price: num('price') ?? 0,
    currency: currency('cur', 'EUR'),
    display: currency('show', 'EUR'),
    hasOriginProof: q.get('proof') !== '0',
    residenceTransfer: q.get('reloc') === '1',
  }
}
