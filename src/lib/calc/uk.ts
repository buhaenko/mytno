import type { Estimate, FxRates, Line, Trip, Vehicle } from '../../types'
import rules from '@config/rules.uk.json'
import { toEur } from '../fx'
import { between, exact, money, nothing, plus, times } from '../money'
import { age, conversion, line, msg, totalOf } from './common'

/**
 * The United Kingdom has no registration tax. What every guide calls the “showroom tax” is
 * the rate of the *first* annual licence, and a genuinely used import never pays it:
 * VERA 1994 s.62(1C) says there is no first vehicle licence at all once the car has been
 * registered abroad for more than six months **and** has covered more than 6 000 km.
 *
 * Both limbs must be met, which is the trap. A four-month-old car with 20 000 km, or a
 * two-year-old car with 3 000, still pays the CO₂ table — and that reaches £5 690.
 *
 * The ordinary annual licence and the expensive-car supplement are real and recurring, so
 * they are named in a note and never added to a one-off total.
 */

const gbp = (amount: number, fx: FxRates) => toEur(amount, 'GBP', fx)

/** Preferential origin zeroes the duty, but only on proof: a private seller rarely has one. */
const preferential = (trip: Trip) => trip.origin === 'EU' && trip.hasOriginProof

/**
 * Does a first vehicle licence exist at all? Only then is the CO₂ table charged, and only
 * for a car whose regime is the 2017-onwards one, which needs a certified CO₂ figure.
 */
export function ukFirstYearVed(v: Vehicle, now: Date) {
  const ved = rules.ved
  const months = age(v, now) * 12
  const used = months > ved.usedTest.months && (v.mileageKm ?? Infinity) > ved.usedTest.km
  if (used) return { gbp: 0, used: true }
  if (v.year < ved.co2RegimeFromYear || v.co2Wltp === undefined) return null

  const co2 = Math.round(v.co2Wltp)
  const band = ved.firstYear.find((b) => b.maxCo2 === null || co2 <= b.maxCo2)!
  // The diesel column is for cars that do not meet Euro 6d; Euro 6d-TEMP does not count.
  return { gbp: v.fuel === 'diesel' ? band.dieselGbp : band.gbp, used: false, co2 }
}

export function estimateUnitedKingdom(v: Vehicle, trip: Trip, fx: FxRates, now = new Date()): Estimate {
  const price = toEur(trip.price, trip.currency, fx)
  const years = age(v, now)
  const value = money(price, price, price * 1.15)

  const lines: Line[] = []
  const warnings = []

  const free = preferential(trip)
  const duty = free ? nothing : times(value, rules.duty)
  lines.push(line('duty', msg('line.duty', { rate: free ? 0 : rules.duty * 100 }), 'tax', duty, {
    formula: '10% × (ціна + доставка до кордону)',
    notes: [msg(free ? 'note.gbOriginProof' : 'note.gbDuty')],
    source: free ? rules.refs.origin : rules.refs.tariff,
  }))

  lines.push(line('vat', msg('line.vat', { rate: rules.vat * 100 }), 'tax', times(plus(value, duty), rules.vat), {
    formula: '20% × (ціна + доставка + мито)',
    notes: [msg('note.gbVat')], source: rules.refs.vatDuty,
  }))

  const ved = ukFirstYearVed(v, now)
  if (ved === null) {
    lines.push(line('regTax', msg('line.gbVed'), 'tax', nothing, {
      unknown: true, notes: [msg('note.gbVedUnknown')], source: rules.refs.ved,
    }))
    warnings.push(msg('warn.gbVedUnknown'))
  } else {
    lines.push(line('regTax', msg('line.gbVed'), 'tax', ved.gbp ? exact(gbp(ved.gbp, fx)) : nothing, {
      notes: [msg(ved.used ? 'note.gbVedUsed' : 'note.gbVedFirst', { standard: rules.ved.standardGbp })],
      source: ved.used ? rules.refs.firstLicence : rules.refs.ved,
    }))
  }

  const fees = rules.fees
  lines.push(line('gbDvla', msg('line.gbDvla'), 'fee', exact(gbp(fees.firstRegistrationGbp, fx)), { source: rules.refs.registration }))
  if (v.market === 'EU') {
    lines.push(line('gbApproval', msg('line.gbConversion'), 'fee', exact(gbp(fees.conversionIvaGbp, fx)), {
      notes: [msg('note.gbConversion')], source: rules.refs.approval,
    }))
    lines.push(line('coc', msg('line.esCoc'), 'fee', between(fees.cocGbp.map((n) => gbp(n, fx))), {
      estimate: true, notes: [msg('note.gbCoc')], source: rules.refs.approval,
    }))
  } else {
    lines.push(line('gbApproval', msg('line.gbIva'), 'fee', exact(gbp(fees.ivaGbp, fx)), {
      notes: [msg('note.gbIva')], source: rules.refs.iva,
    }))
  }
  if (years >= fees.motFromYears) {
    lines.push(line('gbMot', msg('line.gbMot'), 'fee', exact(gbp(fees.motGbp, fx)), { notes: [msg('note.gbMot')], source: rules.refs.mot }))
  }
  lines.push(line('plates', msg('line.plates'), 'fee', between(fees.platesGbp.map((n) => gbp(n, fx))), { estimate: true }))

  const route = v.market === 'US' ? 'US_to_EU' : v.market === 'JP' ? 'JP_to_EU' : ''
  const { list: nuances, mandatory } = route ? conversion(route, v.brandTier) : { list: [], mandatory: nothing }
  if (mandatory.max > 0) {
    lines.push(line('conversion', msg('line.conversionMandatory'), 'fee', mandatory, { estimate: true, notes: [msg('note.conversionMandatory')] }))
  }

  warnings.push(msg('warn.gbAnnual', { standard: rules.ved.standardGbp, supplement: rules.ved.supplement.gbp, threshold: rules.ved.supplement.thresholdGbp }))
  if (trip.origin === 'EU' && !trip.hasOriginProof) warnings.push(msg('warn.gbNeedProof'))

  return {
    lines,
    nuances,
    warnings,
    steps: [msg('chk.gbCustoms'), msg('chk.gbNova'), msg('chk.gbApproval'), msg('chk.gbRegister')],
    total: totalOf(lines),
    taxes: totalOf(lines.filter((l) => l.kind === 'tax')),
    customsValue: value.likely,
    meta: { ageYears: Number(years.toFixed(1)) },
  }
}
