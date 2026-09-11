import { describe, expect, it } from 'vitest'
import type { Estimate, FxRates, Trip, Vehicle } from '../../../types'
import { ageFactor, estimateUkraine, excise, pensionRate } from '../ukraine'
import { depreciation, estimateSpain, iedmtRate } from '../spain'
import { austriaNova, brusselsTmc, croatiaTax, czechiaEmissionFee, denmarkTax, finlandTax, greeceTax, estimateEu, flandersBiv, franceMalus, hungaryTax, irelandVrt, maltaTax, italyIpt, lithuaniaTax, netherlandsBpm, polandExcise, portugalIsv, slovakiaFee, sloveniaDmv, walloniaTmc } from '../eu'
import { checkDigitValid, detectMarket, modelYearFromVin } from '../../vehicle/vin'
import { countryFromPath, routeFromPath, routePath } from '../../pages'
import { fallbackRates } from '../../fx'

/** The bundled rates, with the two the assertions below reason about pinned. */
const fx: FxRates = {
  ...fallbackRates(),
  USD: { rate: 1.1612, date: '2026-09-08', source: 'ecb' },
  UAH: { rate: 51.6383, date: '2026-09-08', source: 'nbu' },
}
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

describe('Pages', () => {
  it('tells a route page from a country page and back again', () => {
    expect(routePath('/', 'uk', 'US', 'UA')).toBe('/uk/import/us-ua/')
    expect(routePath('/', 'en', 'DE', 'PL')).toBe('/import/de-pl/')
    expect(routeFromPath('/uk/import/us-ua/', '/')).toEqual({ from: 'US', to: 'UA' })
    expect(routeFromPath('/import/de-pl/', '/')).toEqual({ from: 'DE', to: 'PL' })
    // A country page is not a route, and neither is anything else.
    expect(routeFromPath('/uk/import/es/', '/')).toBeNull()
    expect(routeFromPath('/uk/', '/')).toBeNull()
    expect(countryFromPath('/uk/import/us-ua/', '/', (code) => code === 'ES')).toBeNull()
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
    expect(e.customsValue).toBeCloseTo(10000 / fx.USD.rate, 2)
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

  it('keeps a line that cannot be counted out of the total but on the page', () => {
    // A Hungarian car first registered before 2021 is charged on an environmental class of
    // decree 6/1990 that is neither CO₂ nor a EURO norm, so the amount is not ours to give.
    const e = estimateEu({ ...audi, market: 'EU' }, { ...trip, origin: 'EU', destination: 'HU', currency: 'EUR' }, fx, now)
    expect(lineOf(e, 'regTax').unknown).toBe(true)
    expect(e.total.likely).toBeCloseTo(e.lines.filter((l) => !l.unknown).reduce((a, l) => a + l.amount.likely, 0), 6)
  })

  it('computes the Dutch BPM from CO₂ and age, never from the price', () => {
    const bpm = netherlandsBpm(audi, now)!
    expect(bpm.asNew).toBeCloseTo(14538 + 594 * (168 - 155), 6)
    expect(bpm.written).toBeCloseTo(80, 6)
    expect(bpm.total).toBeCloseTo(bpm.asNew * 0.2, 6)
    // A diesel of the same year pays €114.83 for every gram above 69 g/km.
    expect(netherlandsBpm({ ...audi, fuel: 'diesel' }, now)!.diesel).toBeCloseTo((168 - 69) * 114.83, 6)
    // An electric car owes the fixed part of the first bracket and nothing per gram.
    expect(netherlandsBpm({ ...audi, fuel: 'electric', co2Wltp: 0 }, now)!.asNew).toBe(687)
    expect(netherlandsBpm({ ...audi, co2Wltp: undefined }, now)).toBeNull()

    const nl = (price: number) =>
      estimateEu({ ...audi, market: 'EU' }, { ...trip, origin: 'EU', destination: 'NL', currency: 'EUR', price }, fx, now)
    expect(lineOf(nl(20000), 'regTax').amount.likely).toBeCloseTo(lineOf(nl(10000), 'regTax').amount.likely, 6)
  })

  it('computes the Portuguese ISV from engine size, CO₂ and age', () => {
    const isv = portugalIsv(audi, now)!
    expect(isv.cylinder).toBeCloseTo(5.61 * 1984 - 6194.88, 6)
    expect(isv.environmental).toBeCloseTo(41.54 * 168 - 5819.56, 6)
    expect(isv.written).toBe(75)
    expect(isv.total).toBeCloseTo((isv.cylinder + isv.environmental) * 0.25, 6)
    // A diesel of the same size reads the diesel table, which is far heavier at this CO₂.
    expect(portugalIsv({ ...audi, fuel: 'diesel' }, now)!.environmental).toBeCloseTo(221.69 * 168 - 29227.38, 6)
    // Electric cars are outside the tax; an old small car still pays the €100 minimum.
    expect(portugalIsv({ ...audi, fuel: 'electric' }, now)!.total).toBe(0)
    expect(portugalIsv({ ...audi, year: 2005, engineCc: 999, co2Wltp: 100 }, now)!.total).toBe(100)
    expect(portugalIsv({ ...audi, co2Wltp: undefined }, now)).toBeNull()
  })

  it('reads the Lithuanian tax off the CO₂ table, twice as much for a diesel', () => {
    expect(lithuaniaTax(audi)!.eur).toBe(80.94)
    expect(lithuaniaTax({ ...audi, fuel: 'diesel' })!.eur).toBe(161.88)
    expect(lithuaniaTax({ ...audi, co2Wltp: 130 })!.eur).toBe(0)
    expect(lithuaniaTax({ ...audi, fuel: 'electric' })!.eur).toBe(0)
    expect(lithuaniaTax({ ...audi, co2Wltp: 400 })!.eur).toBe(364.23)
    expect(lithuaniaTax({ ...audi, co2Wltp: undefined })).toBeNull()
  })

  it('multiplies the Slovak power rate by the coefficient of its emission standard', () => {
    const fee = slovakiaFee(audi, now)!
    expect(Math.round(fee.kw)).toBe(185)
    expect(fee.coef).toBe(0.45)
    expect(fee.eur).toBeCloseTo(900 * 0.45, 6)
    // Never below the flat €33, and a car past forty pays the veteran coefficient.
    expect(slovakiaFee({ ...audi, powerHp: 75, year: 2021 }, now)!.eur).toBe(33)
    expect(slovakiaFee({ ...audi, year: 1980 }, now)!.coef).toBe(0.1)
    expect(slovakiaFee({ ...audi, fuel: 'electric', powerHp: undefined }, now)!.eur).toBe(33)
    expect(slovakiaFee({ ...audi, powerHp: undefined }, now)).toBeNull()
  })

  it('gives the Italian IPT as a range, because the province adds up to 30%', () => {
    const ipt = italyIpt(audi)!
    expect(ipt.base).toBeCloseTo(3.5119 * 252 * 0.7355, 6)
    expect(ipt.max).toBeCloseTo(ipt.base * 1.3, 6)
    // A small engine pays the flat rate instead of the per-kilowatt one.
    expect(italyIpt({ ...audi, powerHp: 70 })!.base).toBe(150.81)
    expect(italyIpt({ ...audi, powerHp: undefined })).toBeNull()

    const e = estimateEu({ ...audi, market: 'EU' }, { ...trip, origin: 'EU', destination: 'IT', currency: 'EUR' }, fx, now)
    const regTax = lineOf(e, 'regTax')
    expect(regTax.unknown).toBeUndefined()
    expect(regTax.amount.max).toBeGreaterThan(regTax.amount.min)
  })

  it('adds up the three Slovenian components and takes the age off the sum', () => {
    const dmv = sloveniaDmv(audi, now)!
    expect(dmv.co2Part).toBeCloseTo(48 + 5 * (168 - 140), 6)
    expect(dmv.powerPart).toBeCloseTo(160 + 7 * (252 * 0.7355 - 60), 6)
    expect(dmv.euroPart).toBe(75)
    expect(dmv.written).toBe(38)
    expect(dmv.total).toBeCloseTo((dmv.co2Part + dmv.powerPart + dmv.euroPart) * 0.38, 6)
    // A diesel of the same car reads the heavier column throughout.
    expect(sloveniaDmv({ ...audi, fuel: 'diesel' }, now)!.euroPart).toBe(112)
    expect(sloveniaDmv({ ...audi, fuel: 'electric' }, now)!.total).toBe(0)
    expect(sloveniaDmv({ ...audi, co2Wltp: undefined }, now)).toBeNull()
  })

  it('reads the Hungarian multiplier off the power and takes the months off the tax', () => {
    const hu = hungaryTax({ ...audi, year: 2022 }, fx, now)!
    expect(hu.multiplier).toBe(6)
    expect(hu.written).toBe(53)
    expect(hu.ft).toBeCloseTo(6 * 47000 * 0.47, 6)
    expect(hu.eur).toBeCloseTo(hu.ft / fx.HUF.rate, 6)
    // A car from before 2021 needs the Hungarian environmental class, so it stays out of the total.
    const old = estimateEu({ ...audi, market: 'EU' }, { ...trip, origin: 'EU', destination: 'HU', currency: 'EUR' }, fx, now)
    expect(lineOf(old, 'regTax').unknown).toBe(true)
    // A hybrid is computed whatever its age.
    const hybrid = estimateEu({ ...audi, fuel: 'hybrid', market: 'EU' }, { ...trip, origin: 'EU', destination: 'HU', currency: 'EUR' }, fx, now)
    expect(lineOf(hybrid, 'regTax').unknown).toBeUndefined()
  })

  it('charges the French malus on the scale of the year the car was first registered', () => {
    const eu = { ...audi, market: 'EU' as const }
    const malus = franceMalus(eu, now)!
    // A 2017 car reads the NEDC scale of 2017, where 168 g/km is €4 253, less the 64% décote at nine years.
    expect(malus.gross).toBe(4253)
    expect(malus.written).toBe(64)
    expect(malus.total).toBeCloseTo(4253 * 0.36, 6)
    // Nothing at all before 2015, and the first taxed gram of 2026 is 108.
    expect(franceMalus({ ...eu, year: 2014 }, now)!.total).toBe(0)
    expect(franceMalus({ ...eu, year: 2026, co2Wltp: 108 }, now)!.gross).toBe(50)
    expect(franceMalus({ ...eu, year: 2026, co2Wltp: 107 }, now)!.gross).toBe(0)
    expect(franceMalus({ ...eu, year: 2026, co2Wltp: 400 }, now)!.gross).toBe(80000)
    expect(franceMalus({ ...eu, co2Wltp: undefined }, now)).toBeNull()
    // A car without European type approval is charged on fiscal horsepower, which we cannot read.
    const us = estimateEu(audi, { ...trip, destination: 'FR' }, fx, now)
    expect(lineOf(us, 'regTax').unknown).toBe(true)
  })

  it('takes the Estonian fee from the register, and says so when it cannot', () => {
    const ee = { ...trip, origin: 'EU' as const, destination: 'EE' as const, currency: 'EUR' as const }
    const car = { ...audi, market: 'EU' as const }
    // Without a gross mass there is nothing to ask with, so the line stays out of the total.
    expect(lineOf(estimateEu(car, ee, fx, now), 'regTax').unknown).toBe(true)
    // With the register's own answer, the line is exactly what it said.
    const answered = estimateEu({ ...car, grossMassKg: 2000 }, ee, fx, now, { total: 528.3, base: 150, co2: 378.3, mass: 0, ageCoef: 0.26 })
    expect(lineOf(answered, 'regTax').unknown).toBeUndefined()
    expect(lineOf(answered, 'regTax').amount.likely).toBe(528.3)
  })

  it('answers Belgium only once the region is named, and differently in each', () => {
    const car = { ...audi, market: 'EU' as const, grossMassKg: 2000 }
    const be = { ...trip, origin: 'EU' as const, destination: 'BE' as const, currency: 'EUR' as const }
    // Without a region there are three possible taxes and no way to choose, so nothing is counted.
    expect(lineOf(estimateEu(car, be, fx, now), 'regTax').unknown).toBe(true)

    const flanders = flandersBiv(car, now)!
    const wallonia = walloniaTmc(car, now)!
    expect(flanders.total).toBeGreaterThan(41.99)
    expect(flanders.total).toBeLessThan(10497.7)
    expect(wallonia.total).toBeGreaterThanOrEqual(50)
    expect(wallonia.total).toBeLessThanOrEqual(9000)
    expect(Math.round(flanders.total)).not.toBe(Math.round(wallonia.total))
    // An electric car pays the Flemish flat rate, and a car past thirty the veteran one.
    expect(flandersBiv({ ...car, fuel: 'electric' }, now)!.total).toBe(61.5)
    expect(flandersBiv({ ...car, year: 1990 }, now)!.total).toBe(41.99)
    // All three regions answer now. Brussels reads a grid of kilowatts and litres, takes the
    // higher, cuts it by whole years and indexes it — the published coefficient reproduces the
    // table to the cent, so a 2.0-litre car in its first year is exactly the published 634.89.
    const brussels = brusselsTmc(car, now)!
    expect(lineOf(estimateEu(car, { ...be, region: 'BR' }, fx, now), 'regTax').unknown).toBeUndefined()
    expect(lineOf(estimateEu(car, { ...be, region: 'BR' }, fx, now), 'regTax').amount.likely).toBeCloseTo(brussels.total, 6)
    expect(brusselsTmc({ ...car, engineCc: 1984, powerHp: 95, year: now.getFullYear(), regMonth: 6 }, now)!.total).toBeCloseTo(634.89, 2)
    expect(brusselsTmc({ ...car, fuel: 'electric' }, now)!.total).toBeCloseTo(78.88, 2)
    expect(brusselsTmc({ ...car, year: 1990 }, now)!.total).toBeCloseTo(78.88, 2)
    expect(lineOf(estimateEu(car, { ...be, region: 'FL' }, fx, now), 'regTax').amount.likely).toBeCloseTo(flanders.total, 6)
  })

  it('counts the four valuation countries from the price, and says so in red', () => {
    const car = { ...audi, market: 'EU' as const, lengthMm: 4726 }
    const eu = { ...trip, origin: 'EU' as const, currency: 'EUR' as const }

    // Ireland: 168 g/km is the 30% band, and the band minimum wins on a cheap car.
    expect(irelandVrt(car, 20000)!.eur).toBeCloseTo(6000, 6)
    expect(irelandVrt(car, 1000)!.eur).toBe(600)
    // Malta charges once on CO₂ and once on length, both as a share of the value.
    const mt = maltaTax(car, 20000)!
    expect(mt.emissions).toBeCloseTo(168 * 20000 * 0.0007, 6)
    expect(mt.size).toBeCloseTo(4726 * 20000 * 0.000032, 6)
    expect(maltaTax({ ...car, lengthMm: undefined }, 20000)).toBeNull()
    // Denmark's brackets bite hard, and an electric car pays a fraction of them.
    const dk = denmarkTax(car, 20000, fx)!
    expect(dk.eur).toBeGreaterThan(10000)
    expect(denmarkTax({ ...car, fuel: 'electric' }, 20000, fx)!.eur).toBeLessThan(dk.eur)
    // Croatia works the new-car price back out of its own residual table.
    const hr = croatiaTax(car, 20000, now)!
    expect(hr.newPrice).toBeGreaterThan(20000)
    expect(hr.eur).toBeGreaterThan(0)
    expect(croatiaTax({ ...car, fuel: 'electric' }, 20000, now)!.eur).toBe(0)

    // Every one of them carries the warning, and none of them hides behind “not in total”.
    for (const destination of ['DK', 'IE', 'HR', 'MT'] as const) {
      const regTax = lineOf(estimateEu(car, { ...eu, destination }, fx, now), 'regTax')
      expect(regTax.unknown).toBeUndefined()
      expect(regTax.estimate).toBe(true)
      expect(regTax.caution).toBeDefined()
    }
  })

  it('reads Finland off its per-gram table and Greece off its price scale', () => {
    const car = { ...audi, market: 'EU' as const }
    // Finland: 168 g/km is 22.7%, and an electric car is not exempt — it lands on the lowest row.
    expect(finlandTax(car, 20000)!.rate).toBe(22.7)
    expect(finlandTax(car, 20000)!.eur).toBeCloseTo(20000 * 0.227, 6)
    expect(finlandTax({ ...car, fuel: 'electric' }, 20000)!.rate).toBe(2.7)
    // Greece: €20 000 is the 16% bracket, 168 g/km lifts it by 30%, EURO 6 adds nothing.
    const gr = greeceTax(car, 20000)!
    expect(gr.rate).toBeCloseTo(16 * 1.3, 6)
    expect(gr.euro).toBe('6')
    // A hybrid pays half of it, an electric car nothing at all, and an older car more.
    expect(greeceTax({ ...car, fuel: 'hybrid' }, 20000)!.rate).toBeCloseTo(gr.rate / 2, 6)
    expect(greeceTax({ ...car, fuel: 'electric' }, 20000)!.eur).toBe(0)
    expect(greeceTax({ ...car, year: 2012 }, 20000)!.rate).toBeCloseTo(gr.rate * 1.5, 6)
  })

  it('reads the Czech emission fee off the model year', () => {
    expect(czechiaEmissionFee(audi).czk).toBe(0)
    expect(czechiaEmissionFee({ ...audi, year: 1999 }).czk).toBe(3000)
    expect(czechiaEmissionFee({ ...audi, year: 1995 }).czk).toBe(5000)
    expect(czechiaEmissionFee({ ...audi, year: 1990 }).czk).toBe(10000)
    const e = estimateEu({ ...audi, year: 1995, market: 'EU' }, { ...trip, origin: 'EU', destination: 'CZ', currency: 'EUR' }, fx, now)
    expect(lineOf(e, 'regTax').unknown).toBeUndefined()
    expect(lineOf(e, 'regTax').amount.likely).toBeCloseTo(5000 / fx.CZK.rate, 6)
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
