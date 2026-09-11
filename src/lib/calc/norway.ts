import type { Estimate, FxRates, Line, Trip, Vehicle } from '../../types'
import rules from '@config/rules.norway.json'
import { toEur } from '../fx'
import { exact, money, nothing, times } from '../money'
import { age, conversion, line, msg, totalOf } from './common'

/**
 * Norway charges the highest registration tax in Europe and charges it on nothing the
 * seller can influence: kerb weight and CO₂, never the price. That makes it exactly
 * computable — the one country where a big number is also a certain one.
 *
 * 2026 rewrote the tax. The NOx component is gone, engine power and displacement no longer
 * appear for cars, and the tax-free CO₂ allowance that every older guide describes was
 * removed: the first gram now costs money. Anything published before January 2026 is wrong.
 */

const nok = (amount: number, fx: FxRates) => toEur(amount, 'NOK', fx)

/** Each band's rate applies to the grams that fall inside it, not to all of them. */
function co2Part(co2: number) {
  let total = 0
  let from = 0
  for (const band of rules.registration.co2Bands) {
    const to = band.maxCo2 ?? Infinity
    if (co2 > from) total += (Math.min(co2, to) - from) * band.nokPerGram
    from = to
    if (co2 <= to) break
  }
  return total
}

/** The deduction is for age *over* the listed figure, so the last row passed is the one that counts. */
function useDeduction(months: number) {
  let pct = 0
  for (const step of rules.registration.useDeduction) if (months > step.overMonths) pct = step.pct
  return pct / 100
}

/**
 * Engangsavgift. The first weight part reaches every car, an electric one included; the
 * second weight part and the whole CO₂ part reach only piston engines. Where no CO₂ is
 * certified the law does not fall back to displacement any more — it derives a figure from
 * the kerb weight instead.
 */
export function norwayRegistrationTax(v: Vehicle, now: Date) {
  const r = rules.registration
  if (!v.kerbMassKg) return null
  const combustion = v.fuel !== 'electric'
  const co2 = v.co2Wltp ?? (combustion ? v.kerbMassKg / r.co2FromMassDivisor : 0)

  const weightAll = Math.max(0, v.kerbMassKg - r.weightAllKg) * r.weightAllNokPerKg
  const weightCombustion = combustion ? Math.max(0, v.kerbMassKg - r.weightCombustionKg) * r.weightCombustionNokPerKg : 0
  const emissions = combustion ? co2Part(co2) : 0

  const months = Math.round(age(v, now) * 12)
  const deduction = useDeduction(months)
  const asNew = weightAll + weightCombustion + emissions
  return {
    nok: Math.max(0, asNew * (1 - deduction)),
    asNew, deduction, months, co2, derivedCo2: v.co2Wltp === undefined && combustion,
  }
}

export function estimateNorway(v: Vehicle, trip: Trip, fx: FxRates, now = new Date()): Estimate {
  const price = toEur(trip.price, trip.currency, fx)
  const value = money(price, price, price * 1.1)

  const lines: Line[] = []
  const warnings = []

  lines.push(line('duty', msg('line.duty', { rate: 0 }), 'tax', nothing, {
    notes: [msg('note.noNoDuty')], source: rules.refs.duty,
  }))

  // An electric car is free of VAT on the first NOK 300 000 of its value and taxed above it.
  const evFreeEur = nok(rules.evVatFreeNok, fx)
  const taxable = v.fuel === 'electric'
    ? money(Math.max(0, value.min - evFreeEur), Math.max(0, value.likely - evFreeEur), Math.max(0, value.max - evFreeEur))
    : value
  lines.push(line('vat', msg('line.vat', { rate: rules.vat * 100 }), 'tax', times(taxable, rules.vat), {
    notes: [msg(v.fuel === 'electric' ? 'note.noEvVat' : 'note.noVat')], source: rules.refs.vat,
  }))

  const tax = norwayRegistrationTax(v, now)
  if (!tax) {
    lines.push(line('regTax', msg('line.noEngangsavgift'), 'tax', nothing, {
      unknown: true, notes: [msg('note.noNeedsMass')], source: rules.refs.registration,
    }))
    warnings.push(msg('warn.noNeedsMass'))
  } else {
    lines.push(line('regTax', msg('line.noEngangsavgift'), 'tax', exact(nok(tax.nok, fx)), {
      formula: '(12,71 × (маса − 500) + 260 × (маса − 1200) + CO₂) × (1 − знижка за вік)',
      notes: [
        msg('note.noEngangsavgift', { deduction: Math.round(tax.deduction * 100) }),
        ...(tax.derivedCo2 ? [msg('note.noDerivedCo2', { co2: Math.round(tax.co2) })] : []),
      ],
      source: rules.refs.registration,
    }))
  }

  lines.push(line('noScrap', msg('line.noScrap'), 'fee', exact(nok(rules.fees.scrapDepositNok, fx)), {
    notes: [msg('note.noScrap')], source: rules.refs.scrap,
  }))
  lines.push(line('noRefrigerant', msg('line.noRefrigerant'), 'fee',
    exact(nok(rules.fees.refrigerantNokPerKg * rules.fees.refrigerantKg, fx)), {
    estimate: true, notes: [msg('note.noRefrigerant')], source: rules.refs.other,
  }))

  const route = v.market === 'US' ? 'US_to_EU' : v.market === 'JP' ? 'JP_to_EU' : ''
  const { list: nuances, mandatory } = route ? conversion(route, v.brandTier) : { list: [], mandatory: nothing }
  if (mandatory.max > 0) {
    lines.push(line('conversion', msg('line.conversionMandatory'), 'fee', mandatory, { estimate: true, notes: [msg('note.conversionMandatory')] }))
  }

  warnings.push(msg('warn.noInspectionPrice'))
  if (v.market === 'JP') warnings.push(msg('warn.rhd'))

  return {
    lines,
    nuances,
    warnings,
    steps: [msg('chk.noCustoms'), msg('chk.noApproval'), msg('chk.noPay'), msg('chk.noRegister')],
    total: totalOf(lines),
    taxes: totalOf(lines.filter((l) => l.kind === 'tax')),
    customsValue: value.likely,
    meta: { ageYears: Number(age(v, now).toFixed(1)) },
  }
}
