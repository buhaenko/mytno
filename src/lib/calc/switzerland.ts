import type { Estimate, FxRates, Line, Trip, Vehicle } from '../../types'
import rules from '@config/rules.switzerland.json'
import { toEur } from '../fx'
import { between, exact, money, nothing, plus, times } from '../money'
import { age, conversion, line, msg, totalOf } from './common'

/**
 * Switzerland is the simplest bill in the app and the one most often quoted wrong.
 *
 * There is no customs duty on a car from anywhere: the industrial tariffs went on
 * 1 January 2024, and the CHF 12–15 per 100 kg that every forum still repeats is dead law.
 * What is left is the 4% automobile tax on what was actually paid, and 8.1% VAT on that
 * plus the automobile tax — which compounds to 12.4224% of the price and nothing else.
 *
 * Because both run off the invoice rather than a Swiss valuation, this is a computed
 * country, not an estimated one. The annual cantonal tax is real but annual, and differs
 * in all twenty-six cantons, so it is named and never counted.
 */

/** Everything in the Swiss config is in francs; the app thinks in euro. */
const chf = (amount: number, fx: FxRates) => toEur(amount, 'CHF', fx)

/**
 * The CO₂ sanction reaches a car that is effectively new, and almost no import is.
 * Art. 17d Abs. 3 CO2-V lets it go once the car has been registered abroad for more than a
 * year, or for more than six months with 5 000 km behind it.
 */
export function swissCo2Sanction(v: Vehicle, now: Date) {
  const rule = rules.co2Sanction
  const months = age(v, now) * 12
  if (months > rule.exemptAfterMonths) return { chf: 0, exempt: true }
  if (months > rule.exemptAfterMonthsWithKm && (v.mileageKm ?? 0) >= rule.exemptKm) return { chf: 0, exempt: true }
  if (v.co2Wltp === undefined || !v.kerbMassKg) return null

  const target = rule.targetBaseGrams + rule.targetSlope * (v.kerbMassKg - rule.referenceMassKg)
  const over = Math.floor(Math.max(0, v.co2Wltp - target) * 100) / 100
  return { chf: over < 0.1 ? 0 : Math.round(over * rule.chfPerGram * 20) / 20, exempt: false, target, over }
}

export function estimateSwitzerland(v: Vehicle, trip: Trip, fx: FxRates, now = new Date()): Estimate {
  const price = toEur(trip.price, trip.currency, fx)
  const years = age(v, now)
  // Freight to the Swiss border belongs in both bases; what it costs nobody publishes.
  const value = money(price, price, price * 1.1)

  const lines: Line[] = []
  const warnings = []

  lines.push(line('duty', msg('line.duty', { rate: 0 }), 'tax', nothing, {
    notes: [msg('note.chNoDuty')], source: rules.refs.tariff,
  }))

  const automobile = times(value, rules.automobileTax)
  lines.push(line('regTax', msg('line.chAutomobile', { rate: rules.automobileTax * 100 }), 'tax', automobile, {
    formula: '4% × (ціна + доставка)',
    notes: [msg('note.chAutomobile')],
    source: rules.refs.automobileTax,
  }))

  lines.push(line('vat', msg('line.vat', { rate: rules.vat * 100 }), 'tax', times(plus(value, automobile), rules.vat), {
    formula: '8,1% × (ціна + доставка + податок на авто)',
    notes: [msg('note.chVat')],
    source: rules.refs.vat,
  }))

  const sanction = swissCo2Sanction(v, now)
  if (sanction === null) {
    lines.push(line('co2Sanction', msg('line.chCo2'), 'tax', nothing, {
      unknown: true, notes: [msg('note.chCo2Needs')], source: rules.refs.co2Calc,
    }))
    warnings.push(msg('warn.chCo2Needs'))
  } else if (!sanction.exempt) {
    lines.push(line('co2Sanction', msg('line.chCo2'), 'tax', exact(chf(sanction.chf, fx)), {
      formula: 'CHF 95 × (CO₂ − (93,6 − 0,0144 · (маса − 1777)))',
      notes: [msg('note.chCo2Due', { target: Math.round((sanction.target ?? 0) * 10) / 10 })],
      source: rules.refs.co2Calc,
    }))
  } else {
    lines.push(line('co2Sanction', msg('line.chCo2'), 'tax', nothing, {
      notes: [msg('note.chCo2Exempt')], source: rules.refs.co2,
    }))
  }

  const fees = rules.fees
  lines.push(line('chCustomsProof', msg('line.chCustomsProof'), 'fee', exact(chf(fees.customsProofChf, fx)), { source: rules.refs.import }))
  lines.push(line('chRegistration', msg('line.chRegistration'), 'fee',
    between(fees.cantonalRegistrationChf.map((n) => chf(n, fx))), { estimate: true, notes: [msg('note.chCantonal')], source: rules.refs.registration }))
  lines.push(line('chInspection', msg('line.chInspection'), 'fee',
    between(fees.inspectionChf.map((n) => chf(n, fx))), { estimate: true, notes: [msg('note.chInspection')], source: rules.refs.registration }))
  lines.push(line('plates', msg('line.plates'), 'fee', between(fees.platesChf.map((n) => chf(n, fx))), { estimate: true }))

  const route = v.market === 'US' ? 'US_to_EU' : v.market === 'JP' ? 'JP_to_EU' : ''
  const { list: nuances, mandatory } = route ? conversion(route, v.brandTier) : { list: [], mandatory: nothing }
  if (mandatory.max > 0) {
    lines.push(line('conversion', msg('line.conversionMandatory'), 'fee', mandatory, { estimate: true, notes: [msg('note.conversionMandatory')] }))
  }

  warnings.push(msg('warn.chCantonalAnnual'))
  if (v.market === 'JP') warnings.push(msg('warn.rhd'))

  return {
    lines,
    nuances,
    warnings,
    steps: [msg('chk.chCustoms'), msg('chk.chForm1320'), msg('chk.chInspection'), msg('chk.chRegister')],
    total: totalOf(lines),
    taxes: totalOf(lines.filter((l) => l.kind === 'tax')),
    customsValue: value.likely,
    meta: { ageYears: Number(years.toFixed(1)) },
  }
}
