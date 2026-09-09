import type { CountryInfo, Destination, Estimate, FxRates, Line, Trip, Vehicle } from '../../types'
import countries from '@config/countries.json'
import netherlands from '@config/rules.netherlands.json'
import portugal from '@config/rules.portugal.json'
import lithuania from '@config/rules.lithuania.json'
import slovakia from '@config/rules.slovakia.json'
import italy from '@config/rules.italy.json'
import slovenia from '@config/rules.slovenia.json'
import hungary from '@config/rules.hungary.json'
import france from '@config/rules.france.json'
import ireland from '@config/rules.ireland.json'
import croatia from '@config/rules.croatia.json'
import { ESTONIA_SOURCE, type EstonianFee } from '../estonia'
import { toEur } from '../fx'
import { exact, money, nothing, percent, plus, times } from '../money'
import { age, builtInEu, conversion, line, msg, newForVat, totalOf } from './common'

export const COUNTRIES = countries.destinations as unknown as Record<Destination, CountryInfo>
/** Passenger cars from outside the EU, TARIC heading 8703. */
export const EU_DUTY = 0.1

/** Polish excise: by engine size, with reliefs for electrified cars. */
export function polandExcise(v: Vehicle): { rate: number; note: string } {
  const rates = countries.poland.rates
  const cc = v.engineCc ?? 0
  if (v.fuel === 'electric') return { rate: 0, note: 'ev' }
  if (v.fuel === 'phev' && cc <= 2000) return { rate: 0, note: 'phev' }
  if (v.fuel === 'hybrid' || v.fuel === 'phev') {
    if (cc <= 2000) return { rate: rates.hybridUpTo2000, note: 'hybridSmall' }
    if (cc <= 3500) return { rate: rates.hybrid2000to3500, note: 'hybridBig' }
  }
  return cc > 2000 ? { rate: rates.over2000, note: 'over' } : { rate: rates.upTo2000, note: 'upTo' }
}

/**
 * Austrian NoVA from 1 January 2026: (CO₂ − 91) / 5 of the price, capped at 80%,
 * less a €350 allowance, plus €80 for every gram above 155 g/km. Electric cars are exempt.
 * Returns null when the car has no certified CO₂ and the tax cannot be computed.
 */
export function austriaNova(v: Vehicle, priceEur: number) {
  const nova = countries.austria
  if (v.fuel === 'electric') return { total: 0, rate: 0, malus: 0 }
  if (!v.co2Wltp) return null

  const rate = Math.min(nova.maxRate, Math.max(0, Math.round((v.co2Wltp - nova.co2Deduction2026) / nova.divisor) / 100))
  const malus = Math.max(0, v.co2Wltp - nova.malusThreshold) * nova.malusPerGram
  return { total: Math.max(0, priceEur * rate - nova.deductionEur) + malus, rate, malus }
}

/**
 * Dutch BPM: a CO₂ table for the car as new, less the official depreciation table for its age.
 * The purchase price never enters it. Returns null when the car has no certified CO₂ — the
 * Belastingdienst then applies a punitive forfait, which is real but far above any actual car.
 */
export function netherlandsBpm(v: Vehicle, now: Date) {
  if (v.co2Wltp === undefined) return null
  const co2 = Math.round(v.co2Wltp)
  const bracket = [...netherlands.co2Brackets].reverse().find((b) => co2 >= b.from)!
  const diesel = v.fuel === 'diesel' ? Math.max(0, co2 - netherlands.diesel.threshold) * netherlands.diesel.perGram : 0
  const asNew = bracket.fixed + bracket.perGram * (co2 - bracket.from) + diesel

  const months = Math.round(age(v, now) * 12)
  const row = [...netherlands.depreciation].reverse().find((r) => months >= r.fromMonths)!
  const written = Math.min(netherlands.maxDepreciationPct, row.startPct + row.monthlyPct * (months - row.fromMonths))
  return { total: Math.max(0, asNew * (1 - written / 100)), asNew, written, co2, diesel }
}

/**
 * The Czech emission fee, paid once when an imported car enters the register.
 * The EURO class is read off the technical certificate; the model year says which one it is.
 */
export function czechiaEmissionFee(v: Vehicle) {
  return countries.czechia.fees.find((f) => v.year >= f.fromYear)!
}

/**
 * Portuguese ISV: a cylinder-capacity component plus an environmental one, each of them
 * rate × value − deduction, less the years-of-use reduction of table D. A negative
 * environmental result is netted against the cylinder component (art. 7.º §4) and the
 * tax never falls below €100. Pure electric cars are outside the tax altogether.
 */
export function portugalIsv(v: Vehicle, now: Date) {
  if (v.fuel === 'electric') return { total: 0, ev: true, cylinder: 0, environmental: 0, written: 0, phev: false }
  if (v.co2Wltp === undefined || !v.engineCc) return null

  const cc = v.engineCc
  const co2 = Math.round(v.co2Wltp)
  const size = portugal.cylinder.find((b) => b.maxCc === null || cc <= b.maxCc)!
  const table = v.fuel === 'diesel' ? portugal.environmental.diesel : portugal.environmental.petrol
  const band = table.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!
  const cylinder = size.perCc * cc - size.deduct
  const environmental = band.perGram * co2 - band.deduct

  // A plug-in below 50 g/km pays a quarter of the rate, as long as it also runs 50 km on the battery.
  const phev = v.fuel === 'phev' && co2 < portugal.intermediate.phevMaxCo2
  const written = portugal.usedReduction.find((r) => r.maxYears === null || age(v, now) <= r.maxYears)!.pct
  const full = (cylinder + environmental) * (phev ? portugal.intermediate.phevRate : 1)
  return { total: Math.max(portugal.minimumEur, full * (1 - written / 100)), cylinder, environmental, written, phev, ev: false, diesel: v.fuel === 'diesel' }
}

/**
 * Lithuania: a flat amount read off the table Regitra publishes, by CO₂ and fuel group.
 * Nothing is due up to 130 g/km, and the diesel column costs exactly twice the petrol one.
 */
export function lithuaniaTax(v: Vehicle) {
  if (v.fuel === 'electric') return { eur: 0, co2: 0, free: true }
  if (v.co2Wltp === undefined) return null
  const co2 = Math.round(v.co2Wltp)
  if (co2 <= lithuania.freeUpToCo2) return { eur: 0, co2, free: true }

  const band = lithuania.bands.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!
  const column = v.fuel === 'diesel' ? band.diesel : v.fuel === 'lpg' ? band.gas : band.petrol
  return { eur: column, co2, free: false }
}

/**
 * Slovakia: the rate for the engine power times an ecological coefficient, which the
 * emission standard sets — and the year of first registration tells us which standard.
 * Electric cars pay the flat minimum.
 */
export function slovakiaFee(v: Vehicle, now: Date) {
  if (v.fuel === 'electric') return { eur: slovakia.flatEur, kw: 0, coef: 0, flat: true }
  if (!v.powerHp) return null

  const kw = v.powerHp * slovakia.hpToKw
  const rate = slovakia.power.find((p) => p.maxKw === null || kw <= p.maxKw)!.eur
  const coef = now.getFullYear() - v.year >= slovakia.veteranYears ? slovakia.veteranCoef
    : v.fuel === 'phev' ? slovakia.plugInOrHydrogenCoef
    : slovakia.eco.find((e) => v.year >= e.fromYear)!.coef
  return { eur: Math.min(slovakia.maxEur, Math.max(slovakia.flatEur, rate * coef)), kw, coef, flat: false }
}

/**
 * Italy: the IPT, a provincial transcription tax on engine power. The national rate is fixed;
 * the province adds up to 30% of it, and since we never learn which province, the answer is a range.
 */
export function italyIpt(v: Vehicle) {
  if (!v.powerHp) return null
  const kw = v.powerHp * italy.hpToKw
  const base = kw <= italy.flatUpToKw ? italy.flatEur : italy.perKwEur * kw
  return { base, kw, max: base * (1 + italy.maxProvincialIncrease) }
}

/**
 * Slovenia: three amounts added together — one for CO₂ and fuel, one for engine power, one for
 * the emission standard — and then reduced for the age of the car. The price never enters it.
 * Returns null without a CO₂ figure: the law's own substitute is €2 247, far above any real car.
 */
export function sloveniaDmv(v: Vehicle, now: Date) {
  if (v.fuel === 'electric') return { total: 0, ev: true, co2Part: 0, powerPart: 0, euroPart: 0, euro: '', written: 0 }
  if (!v.powerHp || v.co2Wltp === undefined) return null

  const diesel = v.fuel === 'diesel'
  const co2 = Math.round(v.co2Wltp)
  const co2Band = [...(diesel ? slovenia.co2.diesel : slovenia.co2.petrol)].reverse().find((b) => co2 >= b.from)!
  const co2Part = co2Band.base + co2Band.perGram * (co2 - co2Band.from)

  const kw = v.powerHp * slovakia.hpToKw
  const powerBand = [...slovenia.power].reverse().find((b) => kw >= b.from)!
  const powerPart = powerBand.base + powerBand.perKw * (kw - powerBand.from)

  const euro = slovenia.euro.find((e) => v.year >= e.fromYear)!
  const euroPart = diesel ? euro.diesel : euro.petrol

  const written = slovenia.age.find((a) => a.maxYears === null || age(v, now) <= a.maxYears)!.pct
  return { total: (co2Part + powerPart + euroPart) * (written / 100), ev: false, co2Part, powerPart, euroPart, euro: euro.euro, written }
}

/**
 * Hungary: a multiplier from engine power and the environmental class, times a base amount that is
 * valorised every January, less a reduction for the months since first registration. We can read the
 * class off the year only for a car first registered from 2021, and for a hybrid of any age.
 */
export function hungaryTax(v: Vehicle, fx: FxRates, now: Date) {
  if (v.fuel === 'electric') return { ft: 0, eur: 0, ev: true, kw: 0, multiplier: 0, written: 0 }
  if (!v.powerHp) return null

  const kw = v.powerHp * hungary.hpToKw
  const multiplier = hungary.multipliers.find((m) => m.maxKw === null || kw <= m.maxKw)!.multiplier
  const months = Math.round(age(v, now) * 12)
  const written = hungary.depreciation.find((d) => d.maxMonths === null || months <= d.maxMonths)!.pct
  const ft = multiplier * hungary.baseFt * (1 - written / 100)
  return { ft, eur: toEur(ft, 'HUF', fx), ev: false, kw, multiplier, written }
}

/**
 * The French CO₂ malus. Three things decide it: the car is charged on the scale of the year it was
 * FIRST registered anywhere, not the year it reaches France; a car first registered before 2015 owes
 * nothing; and only a European type approval is read off CO₂ at all — anything else goes by fiscal
 * horsepower, which we cannot know. The weight malus is a separate tax and needs a mass we do not have.
 */
export function franceMalus(v: Vehicle, now: Date) {
  if (v.year < france.zeroBeforeYear) return { total: 0, gross: 0, written: 0, before2015: true }
  const co2 = v.fuel === 'electric' ? 0 : v.co2Wltp === undefined ? undefined : Math.round(v.co2Wltp)
  if (co2 === undefined) return null

  const year = Math.min(v.year, france.latestWltpYear)
  const scales = france as unknown as { wltp: Record<string, Scale>; nedc: Record<string, Scale> }
  const scale = year >= 2020 ? scales.wltp[String(year)] : scales.nedc[String(year)]

  let gross: number
  if (scale) {
    const step = co2 - scale.firstGram
    gross = step < 0 ? 0 : step < scale.amounts.length ? scale.amounts[step]! : scale.cap
  } else {
    // 2015 and 2016 share one table of bands rather than a row per gram.
    gross = france.nedcBands20152016.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!.eur
  }

  const months = Math.round(age(v, now) * 12)
  const written = france.decote.find((d) => d.maxMonths === null || months <= d.maxMonths)!.pct
  return { total: gross * (1 - written / 100), gross, written, before2015: false }
}

interface Scale { firstGram: number; amounts: number[]; cap: number }

/** Registration tax: computed where we have the formula, a real zero where none exists, otherwise shown but not counted. */
function registrationTax(country: CountryInfo, v: Vehicle, trip: Trip, price: number, fx: FxRates, customsLink: { title: string; url: string }, now: Date, estonia?: EstonianFee | null): { line: Line; warning?: ReturnType<typeof msg> } {
  const exempt = trip.residenceTransfer && trip.origin !== 'EU'

  if (country.regTax === 'none') {
    return { line: line('regTax', msg('line.regTax'), 'tax', nothing, { notes: [msg('note.regTaxNone')], source: countries.regTaxNoneSource }) }
  }
  if (trip.destination === 'EE') return estonianFee(v, exempt, estonia)
  if (trip.destination === 'IE' && v.co2Wltp !== undefined) return irishBand(v)
  if (trip.destination === 'HR' && v.co2Wltp !== undefined) return croatianHalf(v)
  if (country.regTax === 'national') {
    // Point at the authority that levies it where the country names one, not at customs.
    const source = (country as { regTaxSource?: { title: string; url: string } }).regTaxSource ?? customsLink
    return { line: line('regTax', msg('line.regTax'), 'tax', nothing, { unknown: true, notes: [msg('note.regTaxNational')], source }) }
  }

  if (trip.destination === 'NL') return dutchBpm(v, exempt, now)
  if (trip.destination === 'PT') return portugueseIsv(v, exempt, now)
  if (trip.destination === 'LT') return lithuanianTax(v, exempt)
  if (trip.destination === 'SK') return slovakFee(v, exempt, now)
  if (trip.destination === 'IT') return italianIpt(v, exempt)
  if (trip.destination === 'SI') return slovenianDmv(v, exempt, now)
  if (trip.destination === 'HU') return hungarianTax(v, exempt, fx, now)
  if (trip.destination === 'FR') return frenchMalus(v, exempt, now)
  if (trip.destination === 'CZ') return czechFee(v, fx)

  // Austria is the third country in this module with a formula of its own.
  const nova = exempt ? { total: 0, rate: 0, malus: 0 } : austriaNova(v, price)
  if (!nova) {
    return {
      line: line('regTax', msg('line.regTax'), 'tax', nothing, { unknown: true, notes: [msg('note.atNovaNoCo2')], source: countries.austria.source }),
      warning: msg('warn.atNeedCo2'),
    }
  }
  const notes = exempt ? [msg('note.relocation')]
    : v.fuel === 'electric' ? [msg('note.atNovaEv')]
    : [msg('note.atNova', { co2: v.co2Wltp ?? 0, rate: nova.rate * 100, malus: Math.round(nova.malus) })]
  return {
    line: line('regTax', msg('line.regTaxAt', { rate: nova.rate * 100 }), 'tax', exact(nova.total), {
      formula: '(CO₂ − 91) / 5 × price − 350 + malus', notes, source: countries.austria.source,
    }),
  }
}

/** The Netherlands: BPM, from the CO₂ table and the age of the car. */
function dutchBpm(v: Vehicle, exempt: boolean, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = netherlands.source
  if (exempt) {
    return { line: line('regTax', msg('line.regTaxNamed', { name: 'BPM' }), 'tax', nothing, { notes: [msg('note.relocation')], source }) }
  }
  const bpm = netherlandsBpm(v, now)
  if (!bpm) {
    return {
      line: line('regTax', msg('line.regTaxNamed', { name: 'BPM' }), 'tax', nothing, { unknown: true, notes: [msg('note.nlBpmNoCo2')], source }),
      warning: msg('warn.nlNeedCo2'),
    }
  }
  return {
    line: line('regTax', msg('line.regTaxNamed', { name: 'BPM' }), 'tax', exact(bpm.total), {
      formula: 'BPM(CO₂) − depreciation for age',
      notes: [msg('note.nlBpm', { co2: bpm.co2, asNew: Math.round(bpm.asNew), written: Math.round(bpm.written) }),
        ...(bpm.diesel > 0 ? [msg('note.nlBpmDiesel', { diesel: Math.round(bpm.diesel) })] : [])],
      source,
    }),
  }
}

/** Portugal: ISV, from the engine size, the CO₂ and the age of the car. */
function portugueseIsv(v: Vehicle, exempt: boolean, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = portugal.source
  const label = msg('line.regTaxNamed', { name: 'ISV' })
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  const isv = portugalIsv(v, now)
  if (!isv) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.ptIsvNoCo2')], source }),
      warning: msg('warn.ptNeedCo2'),
    }
  }
  const notes = isv.ev ? [msg('note.ptIsvEv')]
    : [msg('note.ptIsv', { cylinder: Math.round(isv.cylinder), environmental: Math.round(isv.environmental), written: isv.written }),
      ...(isv.phev ? [msg('note.ptIsvPhev')] : []),
      ...(isv.diesel ? [msg('note.ptIsvDiesel')] : [])]
  return {
    line: line('regTax', label, 'tax', exact(isv.total), {
      formula: 'cilindrada + ambiental − tabela D', notes, source,
    }),
  }
}

/** Lithuania: the table amount for the car's CO₂ and fuel. */
function lithuanianTax(v: Vehicle, exempt: boolean): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = lithuania.source
  // Lithuania's tax is called exactly “registration tax”, so naming it again would only stutter.
  const label = msg('line.regTax')
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  const tax = lithuaniaTax(v)
  if (!tax) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.ltNoCo2')], source }),
      warning: msg('warn.ltNeedCo2'),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(tax.eur), {
      formula: `CO₂ ${tax.co2} g/km`,
      notes: [msg(tax.free ? 'note.ltFree' : 'note.ltTax', { co2: tax.co2, free: lithuania.freeUpToCo2 })],
      source,
    }),
  }
}

/** Slovakia: engine power times the coefficient of its emission standard. */
function slovakFee(v: Vehicle, exempt: boolean, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = slovakia.source
  const label = msg('line.regTaxNamed', { name: 'poplatok za zápis' })
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  const fee = slovakiaFee(v, now)
  if (!fee) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.skNoPower')], source }),
      warning: msg('warn.skNeedPower'),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(fee.eur), {
      formula: fee.flat ? '33 €' : 'kW × ekologický koeficient',
      notes: [msg(fee.flat ? 'note.skFlat' : 'note.skFee', { kw: Math.round(fee.kw), coef: fee.coef })],
      source,
    }),
  }
}

/** Italy: the IPT, from the national rate up to the highest provincial increase. */
function italianIpt(v: Vehicle, exempt: boolean): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = italy.source
  const label = msg('line.regTaxNamed', { name: 'IPT' })
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  const ipt = italyIpt(v)
  if (!ipt) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.itIptNoPower')], source }),
      warning: msg('warn.itNeedPower'),
    }
  }
  return {
    line: line('regTax', label, 'tax', money(ipt.base, (ipt.base + ipt.max) / 2, ipt.max), {
      formula: '150,81 € ≤ 53 kW, altrimenti 3,5119 €/kW',
      notes: [msg('note.itIpt', { kw: Math.round(ipt.kw), base: Math.round(ipt.base) })],
      source,
    }),
  }
}

/** Slovenia: CO₂, power and emission standard, less the reduction for the car's age. */
function slovenianDmv(v: Vehicle, exempt: boolean, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = slovenia.source
  const label = msg('line.regTaxNamed', { name: 'DMV' })
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  const dmv = sloveniaDmv(v, now)
  if (!dmv) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg(v.powerHp ? 'note.siNoCo2' : 'note.siNoPower')], source }),
      warning: msg(v.powerHp ? 'warn.siNeedCo2' : 'warn.siNeedPower'),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(dmv.total), {
      formula: 'CO₂ + kW + EURO − starost',
      notes: [msg(dmv.ev ? 'note.siEv' : 'note.siDmv', {
        co2: Math.round(dmv.co2Part), power: Math.round(dmv.powerPart), euro: dmv.euro, euroPart: Math.round(dmv.euroPart), written: dmv.written,
      })],
      source,
    }),
  }
}

/** Hungary: the power multiplier on the year's base amount, less the monthly depreciation. */
function hungarianTax(v: Vehicle, exempt: boolean, fx: FxRates, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = hungary.source
  const label = msg('line.regTaxNamed', { name: 'regisztrációs adó' })
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  // Before 2021 the column depends on a Hungarian environmental class, which is neither CO₂ nor a EURO norm.
  const hybrid = v.fuel === 'hybrid' || v.fuel === 'phev'
  const readableClass = hybrid || v.year >= hungary.firstColumnFromYear
  const tax = readableClass ? hungaryTax(v, fx, now) : null
  if (!tax) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg(readableClass ? 'note.huNoPower' : 'note.huOldClass')], source }),
      warning: readableClass ? msg('warn.huNeedPower') : undefined,
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(tax.eur), {
      formula: `${tax.multiplier} × ${hungary.baseFt} Ft − ${tax.written}%`,
      notes: [msg(tax.ev ? 'note.huEv' : 'note.huTax', { kw: Math.round(tax.kw), ft: Math.round(tax.ft), written: tax.written })],
      source,
    }),
  }
}

/** France: the CO₂ malus of the year the car was first registered, less the décote for its age. */
function frenchMalus(v: Vehicle, exempt: boolean, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const source = france.source
  const label = msg('line.regTaxNamed', { name: 'malus CO₂' })
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  // Only a European type approval carries a CO₂ figure the scales can read; the rest go by fiscal horsepower.
  if (v.market !== 'EU' && v.year >= france.zeroBeforeYear) {
    return { line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.frNoApproval')], source }) }
  }

  const malus = franceMalus(v, now)
  if (!malus) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.frNoCo2')], source }),
      warning: msg('warn.frNeedCo2'),
    }
  }
  const notes = malus.before2015 ? [msg('note.frBefore2015')]
    : [msg('note.frMalus', { year: v.year, gross: Math.round(malus.gross), written: malus.written }), msg('note.frWeight')]
  return {
    line: line('regTax', label, 'tax', exact(malus.total), { formula: 'barème de l’année − décote', notes, source }),
  }
}

/**
 * Ireland: the amount is a share of a value Revenue assigns to that exact car, so it is never in
 * the total — but the share itself is published, and naming the band is more use than a shrug.
 */
function irishBand(v: Vehicle): { line: Line } {
  const co2 = Math.round(v.co2Wltp!)
  const band = ireland.bands.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!
  return {
    line: line('regTax', msg('line.regTaxNamed', { name: 'VRT' }), 'tax', nothing, {
      unknown: true,
      notes: [msg('note.ieBand', { co2, rate: band.rate, min: band.minEur }), msg('note.ieNox')],
      source: ireland.source,
    }),
  }
}

/**
 * Croatia: half the tax is a CO₂ table we have, the other half runs off the Croatian list price of
 * the equivalent new car, which customs keep and nobody publishes. So the line names the half it can.
 */
function croatianHalf(v: Vehicle): { line: Line } {
  const co2 = Math.round(v.co2Wltp!)
  const table = v.fuel === 'diesel' ? croatia.co2.diesel : croatia.co2.petrol
  const band = [...table].reverse().find((b) => co2 >= b.from)
  const emissions = band ? band.base + band.perGram * (co2 - band.from) : 0
  return {
    line: line('regTax', msg('line.regTaxNamed', { name: 'poseban porez' }), 'tax', nothing, {
      unknown: true,
      notes: [msg(v.fuel === 'electric' ? 'note.hrEv' : 'note.hrHalf', { co2, emissions: Math.round(emissions) })],
      source: croatia.source,
    }),
  }
}

/** Estonia: what its own register answered, or the reason it could not be asked. */
function estonianFee(v: Vehicle, exempt: boolean, fee?: EstonianFee | null): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: 'registreerimistasu' })
  const source = ESTONIA_SOURCE
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  if (!fee) {
    const missing = (v.fuel !== 'electric' && v.co2Wltp === undefined) || !v.grossMassKg
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg(missing ? 'note.eeNeedData' : 'note.eeNoAnswer')], source }),
      warning: missing ? msg('warn.eeNeedData') : undefined,
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(fee.total), {
      formula: 'Transpordiamet',
      notes: [msg('note.eeFee', { base: Math.round(fee.base), co2: Math.round(fee.co2), mass: Math.round(fee.mass), age: fee.ageCoef })],
      source,
    }),
  }
}

/** Czechia: the one-off emission fee, in koruna, converted at the rate of the day. */
function czechFee(v: Vehicle, fx: FxRates): { line: Line } {
  const fee = czechiaEmissionFee(v)
  const notes = [msg(fee.czk === 0 ? 'note.czEmissionNone' : 'note.czEmission', { euro: fee.euro, czk: fee.czk, year: fee.fromYear })]
  return {
    line: line('regTax', msg('line.regTaxNamed', { name: 'emisní poplatek' }), 'tax', exact(toEur(fee.czk, 'CZK', fx)), {
      formula: `${fee.czk} CZK`, notes, source: countries.czechia.source,
    }),
  }
}

/** Every EU destination except Spain, which has its own module. */
export function estimateEu(v: Vehicle, trip: Trip, fx: FxRates, now = new Date(), estonia?: EstonianFee | null): Estimate {
  const country = COUNTRIES[trip.destination]
  const price = toEur(trip.price, trip.currency, fx)
  const fromOutsideEu = trip.origin !== 'EU'
  const exempt = trip.residenceTransfer && fromOutsideEu
  const cif = money(price, price, price * 1.15)
  const customsLink = { title: new URL(country.customs).hostname.replace('www.', ''), url: country.customs }

  const lines: Line[] = []
  const warnings = []

  let duty = nothing
  if (fromOutsideEu) {
    duty = exempt ? nothing : times(cif, EU_DUTY)
    lines.push(line('duty', msg('line.duty', { rate: exempt ? 0 : EU_DUTY * 100 }), 'tax', duty, {
      formula: '10% × CIF',
      notes: [msg(exempt ? 'note.relocation' : builtInEu(v) ? 'note.euMadeReturn' : 'note.dutyNonEu')],
      source: exempt ? { title: 'Reglamento (CE) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32009R1186' } : countries.euDutySource,
    }))
  }

  let excise = nothing
  if (trip.destination === 'PL') {
    const { rate, note } = polandExcise(v)
    excise = times(fromOutsideEu ? plus(cif, duty) : exact(price), rate)
    lines.push(line('excise', msg('line.plExcise', { rate: rate * 100 }), 'tax', excise, {
      formula: fromOutsideEu ? `${percent(rate)} × (CIF + duty)` : `${percent(rate)} × price`,
      notes: [msg(`note.pl.${note}`)], source: countries.poland.source,
    }))
  }

  const isNew = newForVat(v, now)
  if (fromOutsideEu) {
    const vat = exempt ? nothing : times(plus(plus(cif, duty), excise), country.vat)
    lines.push(line('vat', msg('line.vat', { rate: exempt ? 0 : country.vat * 100 }), 'tax', vat, {
      formula: trip.destination === 'PL' ? `${percent(country.vat)} × (CIF + duty + excise)` : `${percent(country.vat)} × (CIF + duty)`,
      notes: exempt ? [msg('note.relocation')] : undefined,
      source: countries.vatSource,
    }))
  } else {
    lines.push(line('vat', msg('line.vat', { rate: isNew ? country.vat * 100 : 0 }), 'tax', isNew ? times(exact(price), country.vat) : nothing, {
      notes: [msg(isNew ? 'note.newVehicleVat' : 'note.usedEuNoVat')], source: countries.vatSource,
    }))
  }

  const registration = registrationTax(country, v, trip, price, fx, customsLink, now, estonia)
  lines.push(registration.line)
  if (registration.warning) warnings.push(registration.warning)

  lines.push(line('regFees', msg('line.regFees'), 'fee', nothing, { unknown: true, notes: [msg('note.regFeesNational')], source: customsLink }))

  const route = v.market === 'US' ? 'US_to_EU' : v.market === 'JP' ? 'JP_to_EU' : ''
  const { list: nuances, mandatory } = route ? conversion(route, v.brandTier) : { list: [], mandatory: nothing }
  if (mandatory.max > 0) {
    lines.push(line('conversion', msg('line.conversionMandatory'), 'fee', mandatory, { estimate: true, notes: [msg('note.conversionMandatory')] }))
  }

  if (exempt) warnings.push(msg('warn.relocationConditions'))
  if (v.market !== 'EU') warnings.push(msg('warn.nonEuSpec'))
  if (trip.destination === 'DE') warnings.push(msg('warn.deNoRegTax'))

  // When nothing in the total depends on the price, say so instead of leaving the user guessing.
  const priceIsIrrelevant = !fromOutsideEu && !isNew && country.regTax !== 'computed' && country.regTax !== 'api'
  const notice = priceIsIrrelevant ? msg(country.regTax === 'none' ? 'notice.intraEuNoTax' : 'notice.intraEuUsed')
    : exempt ? msg('notice.relocation') : undefined

  return {
    lines,
    nuances,
    notice,
    warnings,
    steps: [msg(fromOutsideEu ? 'chk.euImport' : 'chk.euIntra'), msg('chk.euConformity'), msg('chk.euRegister')],
    total: totalOf(lines),
    taxes: totalOf(lines.filter((l) => l.kind === 'tax')),
    customsValue: cif.likely,
    meta: { vat: country.vat },
  }
}
