import { describe, expect, it } from 'vitest'
import type { FxRates, RouteInput, Vehicle } from '../../../types'
import { ageCoefUa, calcUkraine, exciseUa, pensionRate } from '../ukraine'
import { calcSpain, depreciation, iedmtRate } from '../spain'
import { checkDigitValid, detectMarketSpec, modelYearFromVin } from '../../vin'

const fx: FxRates = { usdUah: 44.4694, eurUah: 51.6383, date: '2026-09-08', source: 'fallback' }
const now = new Date('2026-09-08')

const audi: Vehicle = {
  vin: 'WAUANAF42HN008179', make: 'Audi', model: 'A4 quattro Premium', year: 2017, engineCc: 1984, fuel: 'petrol', powerHp: 252,
  marketSpec: 'US', plantCountry: 'GERMANY', brandTier: 'premium', co2Wltp: 168, listPriceNewEur: 47150, decodeNotes: [],
}
const baseRoute: RouteInput = {
  origin: 'US', destination: 'UA', purchasePrice: 10000, purchaseCurrency: 'USD', boughtFrom: 'auction', hasOriginProof: true,
  residenceTransfer: false, salvage: false, repairBudget: 0, delivery: 'auto', usInland: 'near',
}

describe('VIN', () => {
  it('validates NA check digit and year', () => {
    expect(checkDigitValid('WAUANAF42HN008179')).toBe(true)
    expect(modelYearFromVin('WAUANAF42HN008179')).toBe(2017)
    expect(detectMarketSpec('WAUANAF42HN008179', true).spec).toBe('US')
    expect(detectMarketSpec('WAUZZZF49HA000001', false).spec).toBe('EU')
  })
})

describe('Ukraine 2026', () => {
  it('age coefficient = year - production - 1, clamped 1..15', () => {
    expect(ageCoefUa(2017, now)).toBe(8)
    expect(ageCoefUa(2026, now)).toBe(1)
    expect(ageCoefUa(2000, now)).toBe(15)
  })
  it('excise petrol 2.0 2017 = 50 × 1.984 × 8', () => {
    expect(exciseUa(audi, now).eur).toBeCloseTo(50 * 1.984 * 8, 2)
  })
  it('excise diesel >3500 and electric', () => {
    expect(exciseUa({ ...audi, fuel: 'diesel', engineCc: 3600 }, now).eur).toBeCloseTo(150 * 3.6 * 8, 2)
    expect(exciseUa({ ...audi, fuel: 'electric', batteryKwh: 75 }, now).eur).toBe(75)
    expect(exciseUa({ ...audi, fuel: 'hybrid' }, now).eur).toBe(100)
  })
  it('pension tiers by UAH value', () => {
    expect(pensionRate(500000)).toBe(0.03)
    expect(pensionRate(700000)).toBe(0.04)
    expect(pensionRate(1200000)).toBe(0.05)
  })
  it('US → UA: duty 10%, VAT on value+duty+excise', () => {
    const res = calcUkraine(audi, baseRoute, fx, now)
    const duty = res.items.find((i) => i.key === 'duty')!
    const vat = res.items.find((i) => i.key === 'vat')!
    expect(duty.range.likely).toBeCloseTo(res.customsValue * 0.1, 2)
    const excise = 50 * 1.984 * 8
    expect(vat.range.likely).toBeCloseTo((res.customsValue + duty.range.likely + excise) * 0.2, 2)
    expect(res.total.likely).toBeGreaterThan(res.taxesTotal.likely)
  })
  it('EU-made + EU purchase + proof → duty 0; without proof → 10%', () => {
    const a = calcUkraine(audi, { ...baseRoute, origin: 'EU', purchaseCurrency: 'EUR' }, fx, now)
    expect(a.items.find((i) => i.key === 'duty')!.range.likely).toBe(0)
    const b = calcUkraine(audi, { ...baseRoute, origin: 'EU', hasOriginProof: false }, fx, now)
    expect(b.items.find((i) => i.key === 'duty')!.range.likely).toBeGreaterThan(0)
    const c = calcUkraine({ ...audi, plantCountry: 'UNITED STATES (USA)' }, { ...baseRoute, origin: 'EU' }, fx, now)
    expect(c.items.find((i) => i.key === 'duty')!.range.likely).toBeGreaterThan(0)
  })
})

describe('Spain 2026', () => {
  it('IEDMT brackets and depreciation', () => {
    expect(iedmtRate(100)).toBe(0)
    expect(iedmtRate(140)).toBe(0.0475)
    expect(iedmtRate(168)).toBe(0.0975)
    expect(iedmtRate(210)).toBe(0.1475)
    expect(iedmtRate(undefined)).toBe(0.1475)
    expect(depreciation(9.2)).toBe(0.19)
    expect(depreciation(0.5)).toBe(1)
    expect(depreciation(20)).toBe(0.1)
  })
  it('UA → ES, 10 000 €: duty 10%, IVA 21% on CIF+duty, IEDMT 14.75% for US spec', () => {
    const res = calcSpain(audi, { ...baseRoute, origin: 'UA', destination: 'ES', purchaseCurrency: 'EUR', boughtFrom: 'private' }, fx, now)
    const duty = res.items.find((i) => i.key === 'duty')!
    const vat = res.items.find((i) => i.key === 'vat')!
    const iedmt = res.items.find((i) => i.key === 'iedmt')!
    expect(duty.range.likely).toBeCloseTo(res.customsValue * 0.1, 2)
    expect(vat.range.likely).toBeCloseTo((res.customsValue + duty.range.likely) * 0.21, 2)
    expect(res.meta.iedmtRate).toBe(0.1475)
    // база: 47150 × 0.19 / (1 + 0.21 + 0.1475)
    expect(iedmt.range.likely).toBeCloseTo(((47150 * 0.19) / 1.3575) * 0.1475, 0)
    expect(res.items.some((i) => i.key === 'homolog')).toBe(true)
    expect(res.items.some((i) => i.key === 'conversion')).toBe(true)
    expect(res.taxesTotal.likely).toBeGreaterThan(4000)
    expect(res.taxesTotal.likely).toBeLessThan(5500)
  })
  it('EU spec from EU: no duty/IVA, COC path, lower IEDMT by CO2', () => {
    const res = calcSpain({ ...audi, marketSpec: 'EU' }, { ...baseRoute, origin: 'EU', destination: 'ES', purchaseCurrency: 'EUR', boughtFrom: 'private' }, fx, now)
    expect(res.items.find((i) => i.key === 'duty')).toBeUndefined()
    expect(res.items.find((i) => i.key === 'vat')!.range.likely).toBe(0)
    expect(res.meta.iedmtRate).toBe(0.0975)
    expect(res.items.some((i) => i.key === 'coc')).toBe(true)
    expect(res.items.some((i) => i.key === 'conversion')).toBe(false)
  })
  it('residence transfer zeroes duty, IVA and IEDMT', () => {
    const res = calcSpain(audi, { ...baseRoute, origin: 'UA', destination: 'ES', purchaseCurrency: 'EUR', residenceTransfer: true }, fx, now)
    expect(res.taxesTotal.likely).toBe(0)
  })
})
