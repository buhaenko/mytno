import type { Estimate, FxRates, Line, Trip, Vehicle } from '../../types'
import rules from '@config/rules.ukraine.json'
import { toEur } from '../fx'
import { between, exact, money, plus, times } from '../money'
import { builtInEu, conversion, line, msg, totalOf } from './common'

/** Full years since the year after production, as the excise law counts them. */
export function ageFactor(year: number, now = new Date()): number {
  const raw = now.getFullYear() - year - 1
  return Math.min(rules.excise.ageCoefMax, Math.max(rules.excise.ageCoefMin, raw))
}

/** Excise: a euro rate per litre times the age factor, or a flat amount for electrified cars. */
export function excise(v: Vehicle, now = new Date()): { eur: number; formula: string } {
  const rate = rules.excise
  const litres = (v.engineCc ?? 0) / 1000
  const factor = ageFactor(v.year, now)

  if (v.fuel === 'electric') {
    const kwh = v.batteryKwh ?? 0
    return { eur: kwh * rate.electricPerKwh, formula: `${rate.electricPerKwh} € × ${kwh} kWh` }
  }
  if (v.fuel === 'hybrid' || v.fuel === 'phev') {
    return { eur: rate.hybridFlat, formula: `${rate.hybridFlat} €` }
  }
  const perLitre = v.fuel === 'diesel'
    ? (v.engineCc ?? 0) > 3500 ? rate.dieselPerLitreOver3500 : rate.dieselPerLitreUpTo3500
    : (v.engineCc ?? 0) > 3000 ? rate.petrolPerLitreOver3000 : rate.petrolPerLitreUpTo3000
  return { eur: perLitre * litres * factor, formula: `${perLitre} € × ${litres.toFixed(3)} L × ${factor}` }
}

/** The pension levy on first registration: 3, 4 or 5% of the value. */
export function pensionRate(valueUah: number): number {
  const minimum = rules.pension.subsistenceMinimumUah
  for (const tier of rules.pension.tiers) {
    if (tier.uptoMultiples === null || valueUah <= tier.uptoMultiples * minimum) return tier.rate
  }
  return 0.05
}

/** Duty is 10%, unless the car is electric or was built in the EU and has proof of origin. */
function duty(v: Vehicle, trip: Trip) {
  if (v.fuel === 'electric') return { rate: rules.duty.electric, note: msg('note.dutyEv'), warning: undefined }
  if (trip.origin !== 'EU') return { rate: rules.duty.default, note: msg('note.dutyNonEu'), warning: undefined }
  if (!builtInEu(v)) {
    return { rate: rules.duty.default, note: msg('note.dutyNotEuMade', { plant: v.plantCountry ?? '—' }), warning: msg('warn.dutyNotEuMade') }
  }
  if (!trip.hasOriginProof) return { rate: rules.duty.default, note: msg('note.dutyNonEu'), warning: msg('warn.noOriginProof') }
  return { rate: rules.duty.euOriginWithProof, note: msg('note.dutyEuOrigin'), warning: undefined }
}

export function estimateUkraine(v: Vehicle, trip: Trip, fx: FxRates, now = new Date()): Estimate {
  const usd = (x: number) => toEur(x, 'USD', fx)
  const uah = (x: number) => toEur(x, 'UAH', fx)
  const price = toEur(trip.price, trip.currency, fx)
  // Customs may value the car above the invoice, which is the top of every range.
  const customsValue = money(price, price, price * 1.15)

  const lines: Line[] = []
  const warnings = []
  if (trip.origin === 'US') warnings.push(msg('warn.uaFreight'))

  const { rate: dutyRate, note: dutyNote, warning: dutyWarning } = duty(v, trip)
  if (dutyWarning) warnings.push(dutyWarning)
  const dutyDue = times(customsValue, dutyRate)
  lines.push(line('duty', msg('line.duty', { rate: dutyRate * 100 }), 'tax', dutyDue, {
    notes: [dutyNote], formula: `${dutyRate * 100}% × CV`, source: rules.refs.duty,
  }))

  const { eur: exciseDue, formula } = excise(v, now)
  const exciseNote = v.fuel === 'electric' ? 'note.uaExciseEv'
    : v.fuel === 'hybrid' || v.fuel === 'phev' ? 'note.uaExciseHybrid'
    : 'note.uaExcise'
  lines.push(line('excise', msg('line.excise'), 'tax', exact(exciseDue), {
    notes: [msg(exciseNote, { coef: ageFactor(v.year, now) })], formula, source: rules.refs.excise,
  }))

  const vat = times(plus(plus(customsValue, dutyDue), exact(exciseDue)), rules.vat)
  lines.push(line('vat', msg('line.vat', { rate: rules.vat * 100 }), 'tax', vat, {
    formula: '20% × (CV + duty + excise)', source: rules.refs.vat,
  }))

  const rateAt = (eur: number) => pensionRate(eur * fx.eurUah)
  const pension = money(
    customsValue.min * rateAt(customsValue.min),
    customsValue.likely * rateAt(customsValue.likely),
    customsValue.max * rateAt(customsValue.max),
  )
  const minimum = rules.pension.subsistenceMinimumUah
  lines.push(line('pension', msg('line.pension', { rate: rateAt(customsValue.likely) * 100 }), 'tax', pension, {
    notes: [msg('note.uaPension', { t1: (165 * minimum).toLocaleString('uk-UA'), t2: (290 * minimum).toLocaleString('uk-UA'), pm: minimum })],
    source: rules.refs.pension,
  }))

  lines.push(line('coc', msg('line.uaCoc'), 'fee', times(between(rules.fees.certificateOfConformityUsd), usd(1)), {
    estimate: true, notes: [msg('note.uaCoc')], source: rules.refs.customs,
  }))
  lines.push(line('registration', msg('line.uaRegistration'), 'fee', times(between(rules.fees.registrationUah), uah(1)), {
    estimate: true, notes: [msg('note.uaRegistration')],
  }))

  const route = trip.origin === 'US' ? 'US_to_UA' : trip.origin === 'EU' ? 'EU_to_UA' : ''
  const { list: nuances } = route ? conversion(route, v.brandTier) : { list: [] }

  return {
    lines,
    nuances,
    warnings,
    steps: [
      msg('chk.uaInvoice'),
      msg(trip.origin === 'US' ? 'chk.uaTitle' : 'chk.uaDocs'),
      msg('chk.uaDeclaration'),
      msg('chk.uaRegister'),
    ],
    total: totalOf(lines),
    taxes: totalOf(lines.filter((l) => l.kind === 'tax')),
    customsValue: customsValue.likely,
    meta: { ageFactor: ageFactor(v.year, now), dutyRate, pensionRate: rateAt(customsValue.likely) },
  }
}
