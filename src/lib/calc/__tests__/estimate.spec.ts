import { describe, expect, it } from 'vitest'
import type { Estimate, FxRates, Trip, Vehicle } from '../../../types'
import { ageFactor, estimateUkraine, excise, pensionRate } from '../ukraine'
import { depreciation, estimateSpain, iedmtRate } from '../spain'
import { austriaNova, estimateEu, polandExcise } from '../eu'
import { checkDigitValid, detectMarket, modelYearFromVin } from '../../vehicle/vin'

const fx: FxRates = { usdUah: 44.4694, eurUah: 51.6383, date: '2026-09-08', source: 'fallback' }
const now = new Date('2026-09-08')

const audi: Vehicle = {
  vin: 'WAUANAF42HN008179', make: 'Audi', model: 'A4 quattro Premium', year: 2017, fuel: 'petrol', market: 'US',
  brandTier: 'premium', engineCc: 1984, powerHp: 252, co2Wltp: 168, listPriceEur: 47150, plantCountry: 'GERMANY', notes: [],
}
const trip: Trip = { origin: 'US', destination: 'UA', price: 10000, currency: 'USD', hasOriginProof: true, residenceTransfer: false }
const lineOf = (e: Estimate, id: string) => e.lines.find((l) => l.id === id)!

describe('VIN', () => {
  it('reads the check digit, the model year and the market', () => {
    expect(checkDigitValid('WAUANAF42HN008179')).toBe(true)
    expect(modelYearFromVin('WAUANAF42HN008179')).toBe(2017)
    expect(detectMarket('WAUANAF42HN008179', true).market).toBe('US')
    expect(detectMarket('WAUZZZF49HA000001', false).market).toBe('EU')
  })
})

describe('Ukraine', () => {
  it('counts age from the year after production, clamped to 1…15', () => {
    expect(ageFactor(2017, now)).toBe(8)
    expect(ageFactor(2026, now)).toBe(1)
    expect(ageFactor(2000, now)).toBe(15)
  })

  it('charges excise per litre, per kWh or a flat rate', () => {
    expect(excise(audi, now).eur).toBeCloseTo(50 * 1.984 * 8, 2)
    expect(excise({ ...audi, fuel: 'diesel', engineCc: 3600 }, now).eur).toBeCloseTo(150 * 3.6 * 8, 2)
    expect(excise({ ...audi, fuel: 'electric', batteryKwh: 75 }, now).eur).toBe(75)
    expect(excise({ ...audi, fuel: 'hybrid' }, now).eur).toBe(100)
  })

  it('steps the pension levy by value', () => {
    expect(pensionRate(500_000)).toBe(0.03)
    expect(pensionRate(700_000)).toBe(0.04)
    expect(pensionRate(1_200_000)).toBe(0.05)
  })

  it('taxes a US import: 10% duty, then VAT on value plus duty plus excise', () => {
    const e = estimateUkraine(audi, trip, fx, now)
    expect(e.customsValue).toBeCloseTo((10000 * fx.usdUah) / fx.eurUah, 2)
    expect(lineOf(e, 'duty').amount.likely).toBeCloseTo(e.customsValue * 0.1, 2)
    expect(lineOf(e, 'vat').amount.likely).toBeCloseTo((e.customsValue + lineOf(e, 'duty').amount.likely + 50 * 1.984 * 8) * 0.2, 2)
    expect(e.total.likely).toBeGreaterThan(e.taxes.likely)
  })

  it('waives duty only for an EU-built car bought in the EU with proof of origin', () => {
    const withProof = estimateUkraine(audi, { ...trip, origin: 'EU', currency: 'EUR' }, fx, now)
    expect(lineOf(withProof, 'duty').amount.likely).toBe(0)

    const withoutProof = estimateUkraine(audi, { ...trip, origin: 'EU', hasOriginProof: false }, fx, now)
    expect(lineOf(withoutProof, 'duty').amount.likely).toBeGreaterThan(0)

    const builtElsewhere = estimateUkraine({ ...audi, plantCountry: 'UNITED STATES (USA)' }, { ...trip, origin: 'EU' }, fx, now)
    expect(lineOf(builtElsewhere, 'duty').amount.likely).toBeGreaterThan(0)
  })
})

describe('Spain', () => {
  it('bands the registration tax by CO₂ and depreciates the base', () => {
    expect(iedmtRate(100)).toBe(0)
    expect(iedmtRate(140)).toBe(0.0475)
    expect(iedmtRate(168)).toBe(0.0975)
    expect(iedmtRate(210)).toBe(0.1475)
    expect(iedmtRate(undefined)).toBe(0.1475)
    expect(depreciation(9.2)).toBe(0.19)
    expect(depreciation(0.5)).toBe(1)
    expect(depreciation(20)).toBe(0.1)
  })

  it('charges duty, IVA and the top CO₂ band on a US-spec import', () => {
    const e = estimateSpain(audi, { ...trip, origin: 'UA', destination: 'ES', currency: 'EUR' }, fx, now)
    expect(lineOf(e, 'duty').amount.likely).toBeCloseTo(e.customsValue * 0.1, 2)
    expect(lineOf(e, 'vat').amount.likely).toBeCloseTo((e.customsValue + lineOf(e, 'duty').amount.likely) * 0.21, 2)
    expect(e.meta.iedmtRate).toBe(0.1475)
    expect(lineOf(e, 'regTax').amount.likely).toBeCloseTo(((47150 * 0.19) / 1.3575) * 0.1475, 0)
    expect(lineOf(e, 'homolog')).toBeTruthy()
    expect(lineOf(e, 'conversion')).toBeTruthy()
    expect(e.taxes.likely).toBeGreaterThan(4000)
    expect(e.taxes.likely).toBeLessThan(5500)
  })

  it('leaves a used EU car free of duty and IVA and uses its certified CO₂', () => {
    const e = estimateSpain({ ...audi, market: 'EU' }, { ...trip, origin: 'EU', destination: 'ES', currency: 'EUR' }, fx, now)
    expect(lineOf(e, 'duty')).toBeUndefined()
    expect(lineOf(e, 'vat').amount.likely).toBe(0)
    expect(e.meta.iedmtRate).toBe(0.0975)
    expect(lineOf(e, 'coc')).toBeTruthy()
    expect(e.nuances).toHaveLength(0)
  })

  it('drops every tax on transfer of residence', () => {
    const e = estimateSpain(audi, { ...trip, origin: 'UA', destination: 'ES', currency: 'EUR', residenceTransfer: true }, fx, now)
    expect(e.taxes.likely).toBe(0)
  })
})

describe('Other EU countries', () => {
  it('sets the Polish excise from engine size and fuel', () => {
    expect(polandExcise(audi).rate).toBe(0.031)
    expect(polandExcise({ ...audi, engineCc: 2998 }).rate).toBe(0.186)
    expect(polandExcise({ ...audi, fuel: 'hybrid' }).rate).toBe(0.0155)
    expect(polandExcise({ ...audi, fuel: 'hybrid', engineCc: 2500 }).rate).toBe(0.093)
    expect(polandExcise({ ...audi, fuel: 'phev' }).rate).toBe(0)
    expect(polandExcise({ ...audi, fuel: 'electric', engineCc: 0 }).rate).toBe(0)
  })

  it('stacks duty, excise and VAT for Poland', () => {
    const e = estimateEu(audi, { ...trip, destination: 'PL' }, fx, now)
    const duty = lineOf(e, 'duty').amount.likely
    const excise = lineOf(e, 'excise').amount.likely
    expect(duty).toBeCloseTo(e.customsValue * 0.1, 2)
    expect(excise).toBeCloseTo((e.customsValue + duty) * 0.031, 2)
    expect(lineOf(e, 'vat').amount.likely).toBeCloseTo((e.customsValue + duty + excise) * 0.23, 2)
  })

  it('shows a real zero where a country has no registration tax', () => {
    const e = estimateEu({ ...audi, market: 'EU' }, { ...trip, origin: 'EU', destination: 'DE', currency: 'EUR' }, fx, now)
    expect(lineOf(e, 'duty')).toBeUndefined()
    expect(e.taxes.likely).toBe(0)
    expect(lineOf(e, 'regTax').unknown).toBeUndefined()
    expect(lineOf(e, 'regTax').amount.likely).toBe(0)
  })

  it('keeps a national registration tax out of the total but on the page', () => {
    const e = estimateEu(audi, { ...trip, destination: 'NL' }, fx, now)
    expect(lineOf(e, 'regTax').unknown).toBe(true)
    expect(lineOf(e, 'vat').amount.likely).toBeCloseTo(e.customsValue * 1.1 * 0.21, 2)
    expect(e.total.likely).toBeCloseTo(e.lines.filter((l) => !l.unknown).reduce((a, l) => a + l.amount.likely, 0), 6)
  })

  it('computes the Austrian NoVA and lets the price move the total', () => {
    const nova = austriaNova(audi, 20000)!
    expect(nova.rate).toBeCloseTo(0.15, 6)
    expect(nova.malus).toBe((168 - 155) * 80)
    expect(nova.total).toBeCloseTo(20000 * 0.15 - 350 + 1040, 6)
    expect(austriaNova({ ...audi, fuel: 'electric', co2Wltp: undefined }, 20000)!.total).toBe(0)
    expect(austriaNova({ ...audi, co2Wltp: undefined }, 20000)).toBeNull()
    expect(austriaNova({ ...audi, co2Wltp: 90 }, 20000)!.total).toBe(0)

    const at = (price: number) =>
      estimateEu({ ...audi, market: 'EU' }, { ...trip, origin: 'EU', destination: 'AT', currency: 'EUR', price }, fx, now).total.likely
    expect(at(20000)).toBeGreaterThan(at(10000))
  })
})
