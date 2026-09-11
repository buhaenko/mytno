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
import belgium from '@config/rules.belgium.json'
import denmark from '@config/rules.denmark.json'
import malta from '@config/rules.malta.json'
import finland from '@config/rules.finland.json'
import greece from '@config/rules.greece.json'
import { ESTONIA_SOURCE, type EstonianFee } from '../estonia'
import { fromEur, toEur } from '../fx'
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

/**
 * Flanders: a sixth power of the CO₂, corrected for the fuel and for the year, plus a euro-standard
 * amount, all of it written down by the age of the car. Two forms live side by side — cars first
 * registered after 2020 take the multiplicative q, older ones the additive x.
 */
export function flandersBiv(v: Vehicle, now: Date) {
  const fl = belgium.flanders
  const years = now.getFullYear() - v.year
  if (v.fuel === 'electric') return { total: fl.electricEur, flat: true, euro: '' }
  if (years >= fl.veteranYears) return { total: fl.veteranEur, flat: true, euro: '' }
  if (v.co2Wltp === undefined) return null

  const f = v.fuel === 'lpg' ? fl.fuelFactor.lpg : fl.fuelFactor.other
  const corrected = v.year > 2020
    ? v.co2Wltp * f * (fl.qBase + fl.qStep * Math.max(0, now.getFullYear() - fl.qFromYear))
    : v.co2Wltp * f + fl.xPerYear * (now.getFullYear() - fl.xFromYear)

  const euro = fl.euro.find((e) => v.year >= e.fromYear)!
  const c = v.fuel === 'diesel' ? euro.diesel : euro.petrol
  const months = Math.round(age(v, now) * 12)
  const written = fl.age.find((a) => a.maxMonths === null || months <= a.maxMonths)!.pct

  const raw = ((corrected / fl.divisor) ** fl.exponent * fl.factor + c) * (written / 100)
  return { total: Math.min(fl.maxEur, Math.max(fl.minEur, raw)), flat: false, euro: euro.euro }
}

/** Wallonia: a base by engine power, worn down by age, scaled by CO₂, by mass and by the energy. */
/**
 * Brussels TMC: a grid read twice — once on displacement (the fiscal-horsepower column in
 * litres) and once on kilowatts — with the higher of the two amounts winning, cut by the
 * whole years since the car was first registered anywhere, and then indexed. CO₂ plays no
 * part at all, which makes it the one Belgian region that needs nothing about emissions.
 *
 * The indexed table is published by Bruxelles Fiscalité each July. One coefficient
 * reproduces all seven of its amounts to the cent, so the whole ladder follows from it
 * rather than from a table we would have to re-type. LPG comes off the statutory amount
 * *before* indexation — that is what reproduces the published LPG column — and an electric
 * car, or one past fifteen years, pays the indexed floor.
 */
export function brusselsTmc(v: Vehicle, now: Date) {
  const br = belgium.brussels
  const cents = (n: number) => Math.round(n * 100) / 100
  const floorEur = cents(br.minEur * br.index)
  const years = Math.floor(age(v, now))
  if (v.fuel === 'electric' || years >= br.veteranYears) return { total: floorEur, floor: true, years }

  // The published bands are in tenths of a litre, and the law rounds at the half-decilitre.
  const litres = v.engineCc ? Math.round(v.engineCc / 100) / 10 : undefined
  const kw = v.powerHp ? v.powerHp * slovakia.hpToKw : undefined
  if (litres === undefined && kw === undefined) return null

  const byLitres = litres === undefined ? 0 : br.grid.find((g) => g.maxLitres === null || litres <= g.maxLitres)!.eur
  const byKw = kw === undefined ? 0 : br.grid.find((g) => g.maxKw === null || kw <= g.maxKw)!.eur
  const statutory = Math.max(byLitres, byKw)
  const base = v.fuel === 'lpg' ? Math.max(0, statutory - br.lpgReductionEur) : statutory

  const total = Math.max(floorEur, cents(base * br.index * (br.age[years] / 100)))
  return { total, floor: false, years, base }
}

export function walloniaTmc(v: Vehicle, now: Date) {
  const wa = belgium.wallonia
  const years = Math.floor(now.getFullYear() - v.year)
  if (years >= wa.veteranYears) return { total: wa.veteranEur, flat: true }
  if (!v.powerHp || v.co2Wltp === undefined || !v.grossMassKg) return null

  const kw = v.powerHp * slovakia.hpToKw
  const base = wa.power.find((p) => p.maxKw === null || kw <= p.maxKw)!.eur
  const written = wa.age[Math.min(years, wa.age.length - 1)]!
  const energy = v.fuel === 'electric'
    ? kw <= 120 ? wa.energy.electricUpTo120Kw : kw <= 155 ? wa.energy.electricTo155Kw : kw <= 249 ? wa.energy.electricTo249Kw : wa.energy.electricAbove
    : v.fuel === 'hybrid' || v.fuel === 'phev' ? wa.energy.hybrid : wa.energy.other

  const raw = base * (written / 100) * (v.co2Wltp / wa.co2Divisor) * (v.grossMassKg / wa.massDivisor) * energy
  return { total: Math.min(wa.maxEur, Math.max(wa.minEur, raw)), flat: false }
}

/**
 * Denmark, Ireland and Croatia each tax a value their own authority assigns, and each says in as
 * many words that the invoice is not it. The rates below are exact; the base is the purchase price
 * standing in for a valuation we cannot make, which is why every one of these lines carries a
 * warning in red. The local value is normally the higher of the two, so these read as floors.
 */
export function denmarkTax(v: Vehicle, priceEur: number, fx: FxRates) {
  if (v.co2Wltp === undefined && v.fuel !== 'electric') return null
  const value = fromEur(priceEur, 'DKK', fx)
  const co2 = v.fuel === 'electric' ? 0 : Math.round(v.co2Wltp!)

  let onValue = 0
  let taken = 0
  for (const b of denmark.brackets) {
    const top = b.upToDkk ?? Infinity
    onValue += Math.max(0, Math.min(value, top) - taken) * b.rate
    taken = top
  }
  let surcharge = 0
  let grams = 0
  for (const b of denmark.co2) {
    const top = b.maxGkm ?? Infinity
    surcharge += Math.max(0, Math.min(co2, top) - grams) * b.perGramDkk
    grams = top
  }

  const relief = v.fuel === 'electric' ? denmark.electric : v.fuel === 'phev' ? denmark.plugIn : null
  const share = relief?.share ?? 1
  const deduction = relief?.deductionDkk ?? denmark.deductionDkk
  const dkk = Math.max(0, (onValue + surcharge) * share - deduction)
  return { eur: toEur(dkk, 'DKK', fx), dkk, value, surcharge, deduction }
}

/** Ireland: the published band, taken on the purchase price because the OMSP is Revenue's to set. */
export function irelandVrt(v: Vehicle, priceEur: number) {
  if (v.co2Wltp === undefined && v.fuel !== 'electric') return null
  const co2 = v.fuel === 'electric' ? 0 : Math.round(v.co2Wltp!)
  const band = ireland.bands.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!
  return { eur: Math.max(band.minEur, (band.rate / 100) * priceEur), co2, rate: band.rate, min: band.minEur }
}

/**
 * Croatia: the tax is worked out as if the car were new and then cut to what its age leaves. We do
 * not know the Croatian list price of the new car, so we read it back out of the same table — the
 * purchase price divided by the residual percentage — which is the law's own model run backwards.
 */
export function croatiaTax(v: Vehicle, priceEur: number, now: Date) {
  if (v.fuel === 'electric') return { eur: 0, ev: true, newPrice: 0, asNew: 0, pct: 0 }
  if (v.co2Wltp === undefined) return null
  if (now.getFullYear() - v.year >= 30) return { eur: croatia.over30YearsEur, ev: false, newPrice: 0, asNew: 0, pct: 0 }

  const months = Math.round(age(v, now) * 12)
  const row = croatia.depreciation.find((d) => months <= d.maxMonths)
  const pct = row ? row.pct : Math.max(1, 19.32 - croatia.depreciationBeyond.perYearDrop * Math.floor((months - 180) / 12))
  const newPrice = priceEur / (pct / 100)

  const bracket = [...croatia.priceBrackets].reverse().find((b) => newPrice >= b.from)!
  const onPrice = bracket.base + bracket.rate * (newPrice - bracket.from)

  const co2 = Math.round(v.co2Wltp)
  const table = v.fuel === 'diesel' ? croatia.co2.diesel : croatia.co2.petrol
  const band = [...table].reverse().find((b) => co2 >= b.from)
  const emissions = band ? band.base + band.perGram * (co2 - band.from) : 0

  const asNew = onPrice + emissions
  return { eur: asNew * (pct / 100), ev: false, newPrice, asNew, pct }
}

/** Malta: the registration value multiplied once by the CO₂ and once by the length of the car. */
export function maltaTax(v: Vehicle, priceEur: number) {
  if (v.co2Wltp === undefined && v.fuel !== 'electric') return null
  if (!v.lengthMm) return null

  const raw = v.fuel === 'electric' ? 0 : Math.round(v.co2Wltp!)
  const co2 = v.fuel === 'hybrid' || v.fuel === 'phev' ? Math.round(raw * (1 - malta.hybridCo2Reduction)) : raw
  const onCo2 = malta.co2Wltp.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!
  const onLength = malta.length.find((b) => b.maxMm === null || v.lengthMm! <= b.maxMm)!

  const emissions = co2 * priceEur * (onCo2.pct / 100)
  const size = v.lengthMm * priceEur * (onLength.pct / 100)
  return { eur: emissions + size, co2, emissions, size }
}

/**
 * Finland: a rate per gram of CO₂, straight off the law's own table. Electric cars are not exempt —
 * at 0 g/km they simply land on its lowest row. The base is the Finnish retail value of the same
 * car, which the law says the purchase price may not stand for; here it does, and the line says so.
 */
export function finlandTax(v: Vehicle, priceEur: number) {
  if (v.co2Wltp === undefined && v.fuel !== 'electric') return null
  const co2 = Math.min(v.fuel === 'electric' ? 0 : Math.round(v.co2Wltp!), finland.rates.length - 1)
  const rate = finland.rates[Math.max(0, co2)]!
  return { eur: priceEur * (rate / 100), co2, rate }
}

/**
 * Greece: a rate on the taxable value, lifted by CO₂ and by how far the car's emission standard has
 * fallen behind the current one. Electric cars are outside it; hybrids pay half. The cylinder-capacity
 * tables people still quote were replaced in 2016.
 */
export function greeceTax(v: Vehicle, priceEur: number) {
  if (v.fuel === 'electric') return { eur: 0, ev: true, rate: 0, co2: 0, euro: '' }
  if (v.co2Wltp === undefined) return null

  const co2 = Math.round(v.co2Wltp)
  const base = greece.valueBrackets.find((b) => b.maxValue === null || priceEur <= b.maxValue)!.rate
  const byCo2 = greece.co2Multiplier.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!.factor
  const euro = greece.euroMultiplier.find((e) => v.year >= e.fromYear)!
  const share = v.fuel === 'hybrid' || v.fuel === 'phev' ? greece.hybridShare : 1

  const rate = base * byCo2 * euro.factor * share
  return { eur: priceEur * rate, ev: false, rate: rate * 100, co2, euro: euro.euro }
}

/** Registration tax: computed where we have the formula, a real zero where none exists, otherwise shown but not counted. */
function registrationTax(country: CountryInfo, v: Vehicle, trip: Trip, price: number, fx: FxRates, customsLink: { title: string; url: string }, now: Date, estonia?: EstonianFee | null): { line: Line; warning?: ReturnType<typeof msg> } {
  const exempt = trip.residenceTransfer && trip.origin !== 'EU'

  if (country.regTax === 'none') {
    return { line: line('regTax', msg('line.regTax'), 'tax', nothing, { notes: [msg('note.regTaxNone')], source: countries.regTaxNoneSource }) }
  }
  if (trip.destination === 'BE') return belgianTax(v, trip.region, exempt, now)
  if (trip.destination === 'EE') return estonianFee(v, exempt, estonia)
  if (trip.destination === 'IE') return irishVrt(v, price)
  if (trip.destination === 'HR') return croatianTax(v, price, now)
  if (trip.destination === 'DK') return danishTax(v, price, fx)
  if (trip.destination === 'MT') return malteseTax(v, price)
  if (trip.destination === 'FI') return finnishTax(v, price)
  if (trip.destination === 'GR') return greekTax(v, price)
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

/** Belgium: three regional taxes, and the owner's own address decides which one is theirs. */
function belgianTax(v: Vehicle, region: Trip['region'], exempt: boolean, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: region === 'FL' ? 'BIV' : 'TMC' })
  const source = region === 'WA' ? belgium.wallonia.source : region === 'BR' ? belgium.brussels.source : belgium.flanders.source
  if (exempt) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.relocation')], source }) }

  if (!region) {
    return {
      line: line('regTax', msg('line.regTax'), 'tax', nothing, { unknown: true, notes: [msg('note.beNoRegion')], source: belgium.flanders.source }),
      warning: msg('warn.beNeedRegion'),
    }
  }
  const tax = region === 'FL' ? flandersBiv(v, now) : region === 'BR' ? brusselsTmc(v, now) : walloniaTmc(v, now)
  if (!tax) {
    const missing = region === 'FL' ? 'note.beFlandersNoCo2' : region === 'BR' ? 'note.beBrusselsNeeds' : 'note.beWalloniaNeeds'
    const warn = region === 'FL' ? 'warn.frNeedCo2' : region === 'BR' ? 'warn.beBrusselsNeeds' : 'warn.beWalloniaNeeds'
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg(missing)], source }),
      warning: msg(warn),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(tax.total), {
      formula: region === 'FL' ? '((CO₂ · f · q) / 246)⁶ · 4500 + c'
        : region === 'BR' ? 'max(kW, cyl) × index × age' : 'MB · CO₂/136 · MMA/1838 · C',
      notes: [msg(region === 'FL' ? 'note.beFlanders' : region === 'BR' ? 'note.beBrusselsCalc' : 'note.beWallonia')],
      source,
    }),
  }
}

/** Ireland: the published CO₂ band, on a value Revenue would set for itself. */
function irishVrt(v: Vehicle, price: number): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: 'VRT' })
  const vrt = irelandVrt(v, price)
  if (!vrt) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.ptIsvNoCo2')], source: ireland.source }),
      warning: msg('warn.ieNeedCo2'),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(vrt.eur), {
      estimate: true,
      formula: `${vrt.rate}% × OMSP`,
      notes: [msg('note.ieVrt', { co2: vrt.co2, rate: vrt.rate, min: vrt.min }), msg('note.ieNox')],
      caution: msg('caution.ieBase'),
      source: ireland.source,
    }),
  }
}

/** Croatia: the law's own model, run backwards to reach the new-car price it needs. */
function croatianTax(v: Vehicle, price: number, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: 'poseban porez' })
  const tax = croatiaTax(v, price, now)
  if (!tax) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.hrNoCo2')], source: croatia.source }),
      warning: msg('warn.hrNeedCo2'),
    }
  }
  if (tax.ev) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.hrEv')], source: croatia.source }) }
  return {
    line: line('regTax', label, 'tax', exact(tax.eur), {
      estimate: true,
      formula: 'porez kao za novo vozilo × preostala vrijednost',
      notes: [msg('note.hrTax', { newPrice: Math.round(tax.newPrice), asNew: Math.round(tax.asNew), pct: Math.round(tax.pct) })],
      caution: msg('caution.hrBase'),
      source: croatia.source,
    }),
  }
}

/** Denmark: the brackets and the CO₂ surcharge, on the price paid rather than the Danish valuation. */
function danishTax(v: Vehicle, price: number, fx: FxRates): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: 'registreringsafgift' })
  const tax = denmarkTax(v, price, fx)
  if (!tax) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.dkNoCo2')], source: denmark.source }),
      warning: msg('warn.dkNeedCo2'),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(tax.eur), {
      estimate: true,
      formula: '25 / 85 / 150% + CO₂ − bundfradrag',
      notes: [msg('note.dkTax', { value: Math.round(tax.value), surcharge: Math.round(tax.surcharge), deduction: Math.round(tax.deduction) })],
      caution: msg('caution.dkBase'),
      source: denmark.source,
    }),
  }
}

/** Malta: both halves of the tax, on a value Transport Malta would assess for itself. */
function malteseTax(v: Vehicle, price: number): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: 'registration tax' })
  const tax = maltaTax(v, price)
  if (!tax) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.mtNeedData')], source: malta.source }),
      warning: msg('warn.mtNeedData'),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(tax.eur), {
      estimate: true,
      formula: 'CO₂ × RV × % + length × RV × %',
      notes: [msg('note.mtTax', { co2: Math.round(tax.emissions), size: Math.round(tax.size) })],
      caution: msg('caution.mtBase'),
      source: malta.source,
    }),
  }
}

/** Finland: the rate its table gives, on a value the tax office would set for itself. */
function finnishTax(v: Vehicle, price: number): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: 'autovero' })
  const tax = finlandTax(v, price)
  if (!tax) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.fiNoCo2')], source: finland.source }),
      warning: msg('warn.fiNeedCo2'),
    }
  }
  return {
    line: line('regTax', label, 'tax', exact(tax.eur), {
      estimate: true,
      formula: `${tax.rate}% × yleinen vähittäismyyntiarvo`,
      notes: [msg('note.fiTax', { co2: tax.co2, rate: tax.rate })],
      caution: msg('caution.fiBase'),
      source: finland.source,
    }),
  }
}

/** Greece: the rate its scale gives, on a value AADE would set from a Greek list price. */
function greekTax(v: Vehicle, price: number): { line: Line; warning?: ReturnType<typeof msg> } {
  const label = msg('line.regTaxNamed', { name: 'τέλος ταξινόμησης' })
  const tax = greeceTax(v, price)
  if (!tax) {
    return {
      line: line('regTax', label, 'tax', nothing, { unknown: true, notes: [msg('note.grNoCo2')], source: greece.source }),
      warning: msg('warn.grNeedCo2'),
    }
  }
  if (tax.ev) return { line: line('regTax', label, 'tax', nothing, { notes: [msg('note.grEv')], source: greece.source }) }
  return {
    line: line('regTax', label, 'tax', exact(tax.eur), {
      estimate: true,
      formula: 'συντελεστής × φορολογητέα αξία',
      notes: [msg('note.grTax', { rate: Math.round(tax.rate * 10) / 10, co2: tax.co2, euro: tax.euro })],
      caution: msg('caution.grBase'),
      source: greece.source,
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
  const priceIsIrrelevant = !fromOutsideEu && !isNew && (country.regTax === 'none' || country.regTax === 'national')
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
