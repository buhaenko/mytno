import type { CountryInfo, Destination, Estimate, FxRates, Line, Trip, Vehicle } from '../../types'
import countries from '@config/countries.json'
import { toEur } from '../fx'
import { exact, money, nothing, percent, plus, times } from '../money'
import { builtInEu, conversion, line, msg, newForVat, totalOf } from './common'

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

/** Registration tax: computed where we have the formula, a real zero where none exists, otherwise shown but not counted. */
function registrationTax(country: CountryInfo, v: Vehicle, trip: Trip, price: number, customsLink: { title: string; url: string }): { line: Line; warning?: ReturnType<typeof msg> } {
  const exempt = trip.residenceTransfer && trip.origin !== 'EU'

  if (country.regTax === 'none') {
    return { line: line('regTax', msg('line.regTax'), 'tax', nothing, { notes: [msg('note.regTaxNone')], source: countries.regTaxNoneSource }) }
  }
  if (country.regTax === 'national') {
    // Point at the authority that levies it where the country names one, not at customs.
    const source = (country as { regTaxSource?: { title: string; url: string } }).regTaxSource ?? customsLink
    return { line: line('regTax', msg('line.regTax'), 'tax', nothing, { unknown: true, notes: [msg('note.regTaxNational')], source }) }
  }

  // Austria is the one country in this module with a formula of its own.
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

  const registration = registrationTax(country, v, trip, price, customsLink)
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
