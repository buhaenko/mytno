import type { Msg, Vehicle } from '../../types'
import { decodeVin, titleCase } from './decode'
import { findModel, loadYear, versionFuel, type Version } from './catalog'
import { findEngine, tierForMake } from './reference'
import { checkDigitValid, detectMarket, manufacturer, modelYearFromVin } from './vin'
import { blankVehicle } from '../../state/snapshot'

const note = (key: string, params?: Msg['params']): Msg => ({ key, params })

/**
 * Fills in the CO₂ and the new price that only a European source knows.
 * They decide the registration tax in Spain and Austria, so it is worth the extra lookup.
 */
function addEuropeanEquivalent(v: Vehicle) {
  const match = findEngine(v)
  if (!match) return
  const { model, engine } = match
  v.co2Wltp = engine.co2 || undefined
  if (engine.co2) v.co2Source = 'certified'
  v.listPriceEur = engine.listEur
  v.batteryKwh ??= engine.kwh
  v.powerHp ??= engine.hp
  // NHTSA rounds displacement to whole litres; the reference list has the real figure.
  const rounded = v.engineCc && v.engineCc % 100 === 0
  if (engine.cc && (!v.engineCc || (rounded && Math.abs(v.engineCc - engine.cc) / engine.cc < 0.05))) v.engineCc = engine.cc
  v.notes.push(note('car.note.reference', {
    model: model.model, engine: engine.label, co2: engine.co2 || '—', list: engine.listEur.toLocaleString(),
  }))
}

/** Confirms the exact displacement against the EPA catalogue when the model is in it. */
async function addCatalogueMatch(v: Vehicle) {
  try {
    const year = await loadYear(v.year)
    const match = findModel(year, v.make, v.model)
    if (!match) return
    const sameFuel = match.versions.filter((x) => versionFuel(x) === v.fuel)
    const [best] = (sameFuel.length ? sameFuel : match.versions)
      .slice()
      .sort((a, b) => Math.abs(a[0] - (v.engineCc ?? a[0])) - Math.abs(b[0] - (v.engineCc ?? b[0])))
    if (!best) return
    if (best[0] && (!v.engineCc || Math.abs(best[0] - v.engineCc) / best[0] < 0.06)) v.engineCc = best[0]
    v.notes.push(note('car.note.epaMatch', { model: match.model }))
    // An EPA figure is a real measurement on the wrong cycle. Better in the field, marked,
    // than an empty box that quietly sends the calculation to the punitive rate.
    if (best[3] && v.co2Wltp === undefined) {
      v.co2Wltp = best[3]
      v.co2Source = 'epa'
      v.notes.push(note('car.note.epaCo2Filled', { co2: best[3] }))
    } else if (best[3]) {
      v.notes.push(note('car.note.epaCo2'))
    }
  } catch { /* the catalogue is optional */ }
}

export interface Identified {
  vehicle: Vehicle
  /** A message key when the VIN could not be turned into a car. */
  error?: string
}

/** Everything we can learn from 17 characters. */
export async function identifyByVin(vin: string, previous: Vehicle): Promise<Identified> {
  const decoded = await decodeVin(vin)
  const maker = manufacturer(vin)
  const market = detectMarket(vin, decoded.clean)
  const make = decoded.make ? titleCase(decoded.make) : ''

  const vehicle: Vehicle = {
    ...previous,
    vin,
    make,
    model: [decoded.model, decoded.series, decoded.trim].filter(Boolean).join(' '),
    year: decoded.year ?? modelYearFromVin(vin) ?? previous.year,
    fuel: decoded.fuel,
    market: market.market,
    brandTier: make ? tierForMake(make) : 'mass',
    engineCc: decoded.engineCc,
    powerHp: decoded.powerHp,
    batteryKwh: decoded.batteryKwh,
    plantCountry: decoded.plantCountry,
    drive: decoded.drive,
    co2Wltp: undefined,
    listPriceEur: undefined,
    notes: [note(`car.note.${market.reason}`, { country: maker.country ?? maker.label })],
  }

  if (make && vehicle.model) await addCatalogueMatch(vehicle)
  addEuropeanEquivalent(vehicle)

  if (!vehicle.engineCc && vehicle.fuel !== 'electric') {
    vehicle.notes.push(note('car.note.nhtsaLimited', { country: maker.country ?? maker.label }))
  }
  if (!checkDigitValid(vin) && maker.region === 'NA') vehicle.notes.push(note('car.note.checkDigit'))

  return { vehicle, error: make ? undefined : 'car.err.notRecognized' }
}

/** A car picked from the catalogue by hand. */
export function identifyByCatalog(make: string, model: string, year: number, version: Version, market: Vehicle['market'], label: string): Vehicle {
  const vehicle: Vehicle = {
    ...blankVehicle(),
    make,
    model,
    year,
    fuel: versionFuel(version),
    market,
    brandTier: tierForMake(make),
    engineCc: version[0] || undefined,
    drive: version[5],
    notes: [note('car.note.catalogPick', { version: label })],
  }
  // The reference list first: it carries the certified European figure where it has one.
  addEuropeanEquivalent(vehicle)
  if (version[3] && vehicle.co2Wltp === undefined) {
    vehicle.co2Wltp = version[3]
    vehicle.co2Source = 'epa'
    vehicle.notes.push(note('car.note.epaCo2Filled', { co2: version[3] }))
  } else if (version[3]) {
    vehicle.notes.push(note('car.note.epaCo2'))
  }
  return vehicle
}
