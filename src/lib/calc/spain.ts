import type { Estimate, FxRates, Line, Money, Trip, Vehicle } from '../../types'
import rules from '@config/rules.spain.json'
import { toEur } from '../fx'
import { between, exact, money, nothing, plus, times } from '../money'
import { age, builtInEu, conversion, line, msg, newForVat, totalOf } from './common'

/** Registration tax band by CO₂; an uncertified car always lands in the top band. */
export function iedmtRate(co2?: number): number {
  if (!co2) return rules.iedmt.unknownCo2Rate
  for (const band of rules.iedmt.brackets) if (band.maxCo2 === null || co2 < band.maxCo2) return band.rate
  return rules.iedmt.unknownCo2Rate
}

/** Share of the new price the tax office still recognises at this age. */
export function depreciation(years: number): number {
  for (const step of rules.iedmt.depreciation) if (step.maxYears === null || years <= step.maxYears) return step.pct
  return 0.1
}

/**
 * The registration tax is charged on the official new-price table times an age
 * coefficient, net of the VAT and the tax itself that the table price includes.
 */
function registrationTax(v: Vehicle, trip: Trip, price: number, years: number) {
  const certified = !!v.co2Wltp
  const euSpec = v.market === 'EU'
  const rate = euSpec ? iedmtRate(certified ? v.co2Wltp : undefined) : rules.iedmt.unknownCo2Rate
  const bestRate = certified ? iedmtRate(v.co2Wltp) : rate
  const factor = depreciation(years)

  let base: Money
  let baseNote
  if (v.listPriceEur) {
    const gross = v.listPriceEur * factor
    base = money(gross / (1 + rules.vat + bestRate), gross / (1 + rules.vat + rate), gross)
    baseNote = msg('note.iedmtBaseTable', { list: Math.round(v.listPriceEur).toLocaleString('uk-UA'), dep: Math.round(factor * 100), age: years.toFixed(1) })
  } else {
    base = money(price * 0.9, price, price * 1.3)
    baseNote = msg('note.iedmtBasePrice')
  }

  const rateNote = !euSpec
    ? msg(certified ? 'note.iedmtNoCertCo2Alt' : 'note.iedmtNoCert', { rate: rate * 100, co2: v.co2Wltp ?? 0, alt: bestRate * 100 })
    : msg('note.iedmtCo2', { co2: certified ? String(v.co2Wltp) : '—', rate: rate * 100 })

  const exempt = trip.residenceTransfer && trip.origin !== 'EU'
  const due = exempt ? nothing : money(base.min * bestRate, base.likely * rate, base.max * rate)
  return { due, rate: exempt ? 0 : rate, notes: exempt ? [msg('note.relocation')] : [rateNote, baseNote] }
}

export function estimateSpain(v: Vehicle, trip: Trip, fx: FxRates, now = new Date()): Estimate {
  const price = toEur(trip.price, trip.currency, fx)
  const fromOutsideEu = trip.origin !== 'EU'
  const exempt = trip.residenceTransfer && fromOutsideEu
  const years = age(v, now)
  const cif = money(price, price, price * 1.15)

  const lines: Line[] = []
  const warnings = []

  if (fromOutsideEu) {
    const duty = exempt ? nothing : times(cif, rules.duty)
    lines.push(line('duty', msg('line.duty', { rate: exempt ? 0 : rules.duty * 100 }), 'tax', duty, {
      formula: '10% × CIF',
      notes: [msg(exempt ? 'note.relocation' : builtInEu(v) ? 'note.euMadeReturn' : 'note.dutyNonEu')],
      source: exempt ? rules.refs.franquicia : rules.refs.duty,
    }))
    const vat = exempt ? nothing : times(plus(cif, duty), rules.vat)
    lines.push(line('vat', msg('line.iva', { rate: exempt ? 0 : rules.vat * 100 }), 'tax', vat, {
      formula: '21% × (CIF + duty)',
      notes: [msg(exempt ? 'note.relocation' : 'note.esCanarias')],
      source: exempt ? rules.refs.franquicia : rules.refs.vat,
    }))
  } else {
    const isNew = newForVat(v, now)
    lines.push(line('vat', msg('line.iva', { rate: isNew ? rules.vat * 100 : 0 }), 'tax', isNew ? times(exact(price), rules.vat) : nothing, {
      notes: [msg(isNew ? 'note.newVehicleVat' : 'note.usedEuNoVat')], source: rules.refs.dgtEu,
    }))
  }

  const iedmt = registrationTax(v, trip, price, years)
  lines.push(line('regTax', msg('line.iedmt', { rate: iedmt.rate * 100 }), 'tax', iedmt.due, {
    formula: 'rate(CO₂) × base', notes: iedmt.notes, source: rules.refs.iedmt,
  }))
  if (v.market !== 'EU' && !exempt) warnings.push(msg('warn.esNoCertCo2'))
  if (v.market === 'EU' && !v.co2Wltp) warnings.push(msg('warn.esEnterCo2'))
  if (exempt) warnings.push(msg('warn.relocationConditions'))
  if (v.market === 'JP') warnings.push(msg('warn.rhd'))
  if (trip.origin === 'UA') warnings.push(msg('warn.esResident30days'))

  const fees = rules.fees
  if (v.market === 'EU') {
    lines.push(line('coc', msg('line.esCoc'), 'fee', between(fees.cocFromManufacturerEur), { estimate: true, notes: [msg('note.esCoc')], source: rules.refs.dgtEu }))
    lines.push(line('ficha', msg('line.esFicha'), 'fee', plus(between(fees.fichaReducidaEur), between(fees.itvImportEur)), { estimate: true, notes: [msg('note.esFicha')], source: rules.refs.dgtEu }))
  } else {
    lines.push(line('homolog', msg('line.esHomolog'), 'fee', between(fees.individualHomologationEur), { estimate: true, notes: [msg('note.esHomolog')], source: rules.refs.homolog }))
    lines.push(line('itv', msg('line.esItv'), 'fee', between(fees.itvImportEur), { estimate: true, notes: [msg('note.esItv')], source: rules.refs.dgtNonEu }))
  }
  lines.push(line('dgt', msg('line.esDgt'), 'fee', exact(fees.dgtTasaEur), { source: rules.refs.dgtTasa }))
  lines.push(line('plates', msg('line.plates'), 'fee', between(fees.platesEur), { estimate: true }))

  const route = v.market === 'US' ? 'US_to_EU' : v.market === 'JP' ? 'JP_to_EU' : ''
  const { list: nuances, mandatory } = route ? conversion(route, v.brandTier) : { list: [], mandatory: nothing }
  if (mandatory.max > 0) {
    lines.push(line('conversion', msg('line.conversionMandatory'), 'fee', mandatory, { estimate: true, notes: [msg('note.conversionMandatory')] }))
  }

  return {
    lines,
    nuances,
    notice: !fromOutsideEu && !newForVat(v, now) ? undefined : exempt ? msg('notice.relocation') : undefined,
    warnings,
    steps: [
      msg(fromOutsideEu ? 'chk.esDua' : 'chk.euIntra'),
      msg(v.market === 'EU' ? 'chk.esCocPath' : 'chk.esLabPath'),
      msg('chk.es576'),
      msg('chk.esDgt'),
    ],
    total: totalOf(lines),
    taxes: totalOf(lines.filter((l) => l.kind === 'tax')),
    customsValue: cif.likely,
    meta: { iedmtRate: iedmt.rate, depreciation: depreciation(years), ageYears: Number(years.toFixed(1)) },
  }
}
