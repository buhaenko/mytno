import type { CountryInfo, Destination, Estimate, FxRates, Line, Trip, Vehicle } from '../../types'
import countries from '@config/countries.json'
import netherlands from '@config/rules.netherlands.json'
import portugal from '@config/rules.portugal.json'
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

/** Registration tax: computed where we have the formula, a real zero where none exists, otherwise shown but not counted. */
function registrationTax(country: CountryInfo, v: Vehicle, trip: Trip, price: number, fx: FxRates, customsLink: { title: string; url: string }, now: Date): { line: Line; warning?: ReturnType<typeof msg> } {
  const exempt = trip.residenceTransfer && trip.origin !== 'EU'

  if (country.regTax === 'none') {
    return { line: line('regTax', msg('line.regTax'), 'tax', nothing, { notes: [msg('note.regTaxNone')], source: countries.regTaxNoneSource }) }
  }
  if (country.regTax === 'national') {
    // Point at the authority that levies it where the country names one, not at customs.
    const source = (country as { regTaxSource?: { title: string; url: string } }).regTaxSource ?? customsLink
    return { line: line('regTax', msg('line.regTax'), 'tax', nothing, { unknown: true, notes: [msg('note.regTaxNational')], source }) }
  }

  if (trip.destination === 'NL') return dutchBpm(v, exempt, now)
  if (trip.destination === 'PT') return portugueseIsv(v, exempt, now)
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
export function estimateEu(v: Vehicle, trip: Trip, fx: FxRates, now = new Date()): Estimate {
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

  const registration = registrationTax(country, v, trip, price, fx, customsLink, now)
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
  const priceIsIrrelevant = !fromOutsideEu && !isNew && country.regTax !== 'computed'
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
