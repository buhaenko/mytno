import { describe, expect, it } from 'vitest'
import type { FxRates, RouteInput, Vehicle } from '../../../types'
import { ageCoefUa, calcUkraine, exciseUa, pensionRate } from '../ukraine'
import { calcSpain, depreciation, iedmtRate } from '../spain'
import { austriaNova, calcEu, polandExciseRate } from '../eu'
import { checkDigitValid, detectMarketSpec, modelYearFromVin } from '../../vin'

const fx: FxRates = { usdUah: 44.4694, eurUah: 51.6383, date: '2026-09-08', source: 'fallback' }
const now = new Date('2026-09-08')

const audi: Vehicle = {
  vin: 'WAUANAF42HN008179', make: 'Audi', model: 'A4 quattro Premium', year: 2017, engineCc: 1984, fuel: 'petrol', powerHp: 252,
  marketSpec: 'US', plantCountry: 'GERMANY', brandTier: 'premium', co2Wltp: 168, listPriceNewEur: 47150, decodeNotes: [],
}
const baseRoute: RouteInput = {
  origin: 'US', destination: 'UA', purchasePrice: 10000, purchaseCurrency: 'USD', hasOriginProof: true, residenceTransfer: false,
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
    expect(res.customsValue).toBeCloseTo((10000 * fx.usdUah) / fx.eurUah, 2)
    const duty = res.items.find((i) => i.key === 'duty')!
    const vat = res.items.find((i) => i.key === 'vat')!
    expect(duty.range.likely).toBeCloseTo(res.customsValue * 0.1, 2)
    const excise = 50 * 1.984 * 8
    expect(vat.range.likely).toBeCloseTo((res.customsValue + duty.range.likely + excise) * 0.2, 2)
    expect(res.total.likely).toBeGreaterThan(res.taxesTotal.likely)
    expect(res.items.map((x) => x.category)).not.toContain('logistics')
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
    const res = calcSpain(audi, { ...baseRoute, origin: 'UA', destination: 'ES', purchaseCurrency: 'EUR' }, fx, now)
    const duty = res.items.find((i) => i.key === 'duty')!
    const vat = res.items.find((i) => i.key === 'vat')!
    const iedmt = res.items.find((i) => i.key === 'iedmt')!
    expect(duty.range.likely).toBeCloseTo(res.customsValue * 0.1, 2)
    expect(vat.range.likely).toBeCloseTo((res.customsValue + duty.range.likely) * 0.21, 2)
    expect(res.meta.iedmtRate).toBe(0.1475)
    // base: 47150 × 0.19 / (1 + 0.21 + 0.1475)
    expect(iedmt.range.likely).toBeCloseTo(((47150 * 0.19) / 1.3575) * 0.1475, 0)
    expect(res.items.some((i) => i.key === 'homolog')).toBe(true)
    expect(res.items.some((i) => i.key === 'conversion')).toBe(true)
    expect(res.nuances.length).toBeGreaterThan(0)
    expect(res.taxesTotal.likely).toBeGreaterThan(4000)
    expect(res.taxesTotal.likely).toBeLessThan(5500)
  })
  it('EU spec from EU: no duty/IVA, COC path, lower IEDMT by CO2', () => {
    const res = calcSpain({ ...audi, marketSpec: 'EU' }, { ...baseRoute, origin: 'EU', destination: 'ES', purchaseCurrency: 'EUR' }, fx, now)
    expect(res.items.find((i) => i.key === 'duty')).toBeUndefined()
    expect(res.items.find((i) => i.key === 'vat')!.range.likely).toBe(0)
    expect(res.meta.iedmtRate).toBe(0.0975)
    expect(res.items.some((i) => i.key === 'coc')).toBe(true)
    expect(res.nuances.length).toBe(0)
  })
  it('residence transfer zeroes duty, IVA and IEDMT', () => {
    const res = calcSpain(audi, { ...baseRoute, origin: 'UA', destination: 'ES', purchaseCurrency: 'EUR', residenceTransfer: true }, fx, now)
    expect(res.taxesTotal.likely).toBe(0)
  })
})

describe('EU generic 2026', () => {
  it('Poland: excise by cc and fuel', () => {
    expect(polandExciseRate(audi).rate).toBe(0.031)
    expect(polandExciseRate({ ...audi, engineCc: 2998 }).rate).toBe(0.186)
    expect(polandExciseRate({ ...audi, fuel: 'hybrid' }).rate).toBe(0.0155)
    expect(polandExciseRate({ ...audi, fuel: 'hybrid', engineCc: 2500 }).rate).toBe(0.093)
    expect(polandExciseRate({ ...audi, fuel: 'phev' }).rate).toBe(0)
    expect(polandExciseRate({ ...audi, fuel: 'electric', engineCc: 0 }).rate).toBe(0)
  })
  it('US → PL: duty 10%, excise on CIF+duty, VAT 23% on CIF+duty+excise', () => {
    const res = calcEu(audi, { ...baseRoute, destination: 'PL' }, fx, now)
    const duty = res.items.find((i) => i.key === 'duty')!.range.likely
    const excise = res.items.find((i) => i.key === 'excise')!.range.likely
    const vat = res.items.find((i) => i.key === 'vat')!.range.likely
    expect(duty).toBeCloseTo(res.customsValue * 0.1, 2)
    expect(excise).toBeCloseTo((res.customsValue + duty) * 0.031, 2)
    expect(vat).toBeCloseTo((res.customsValue + duty + excise) * 0.23, 2)
  })
  it('EU → DE used: no duty, no VAT, registration tax is a real zero', () => {
    const de = calcEu({ ...audi, marketSpec: 'EU' }, { ...baseRoute, origin: 'EU', destination: 'DE', purchaseCurrency: 'EUR' }, fx, now)
    expect(de.items.find((i) => i.key === 'duty')).toBeUndefined()
    expect(de.taxesTotal.likely).toBe(0)
    const reg = de.items.find((i) => i.key === 'regTax')!
    expect(reg.unknown).toBeUndefined()
    expect(reg.range.likely).toBe(0)
  })
  it('NL registration tax exists but is not computed, so it stays out of the total', () => {
    const nl = calcEu(audi, { ...baseRoute, destination: 'NL' }, fx, now)
    const reg = nl.items.find((i) => i.key === 'regTax')!
    expect(reg.unknown).toBe(true)
    expect(nl.items.find((i) => i.key === 'vat')!.range.likely).toBeCloseTo((nl.customsValue * 1.1) * 0.21, 2)
    expect(nl.total.likely).toBeCloseTo(nl.items.filter((i) => !i.unknown).reduce((a, i) => a + i.range.likely, 0), 6)
  })
  it('Austria NoVA 2026: (CO2 − 91) / 5 of the price, minus 350, plus 80 € per gram over 155', () => {
    const nova = austriaNova(audi, 20000)!
    expect(nova.rate).toBeCloseTo(0.15, 6)
    expect(nova.malus).toBe((168 - 155) * 80)
    expect(nova.total).toBeCloseTo(20000 * 0.15 - 350 + 1040, 6)
    expect(austriaNova({ ...audi, fuel: 'electric', co2Wltp: undefined }, 20000)!.total).toBe(0)
    expect(austriaNova({ ...audi, co2Wltp: undefined }, 20000)).toBeNull()
    expect(austriaNova({ ...audi, co2Wltp: 90 }, 20000)!.total).toBe(0)
  })
  it('EU → AT used car: the price still moves the total through NoVA', () => {
    const at = (price: number) => calcEu({ ...audi, marketSpec: 'EU' }, { ...baseRoute, origin: 'EU', destination: 'AT', purchaseCurrency: 'EUR', purchasePrice: price }, fx, now).total.likely
    expect(at(20000)).toBeGreaterThan(at(10000))
  })
})
