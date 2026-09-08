import type { CalcResult, FxRates, LineItem, RouteInput, Vehicle } from '../../types'
import rules from '../../data/rules.ukraine.json'
import { toEur } from '../fx'
import { addR, fixed, r, scaleR, span, zero } from '../money'
import { isEuMade, item, m, nuancesFor, sumItems } from './common'

export function ageCoefUa(year: number, now = new Date()): number {
  const raw = now.getFullYear() - year - 1
  return Math.min(rules.excise.ageCoefMax, Math.max(rules.excise.ageCoefMin, raw))
}

export function exciseUa(v: Vehicle, now = new Date()): { eur: number; formula: string } {
  const ex = rules.excise
  const coef = ageCoefUa(v.year, now)
  const litres = (v.engineCc ?? 0) / 1000
  switch (v.fuel) {
    case 'electric': { const kwh = v.batteryKwh ?? 0; return { eur: kwh * ex.electricPerKwh, formula: `${ex.electricPerKwh} € × ${kwh} kWh` } }
    case 'hybrid':
    case 'phev': return { eur: ex.hybridFlat, formula: `${ex.hybridFlat} €` }
    case 'diesel': { const base = (v.engineCc ?? 0) > 3500 ? ex.dieselPerLitreOver3500 : ex.dieselPerLitreUpTo3500; return { eur: base * litres * coef, formula: `${base} € × ${litres.toFixed(3)} L × ${coef}` } }
    default: { const base = (v.engineCc ?? 0) > 3000 ? ex.petrolPerLitreOver3000 : ex.petrolPerLitreUpTo3000; return { eur: base * litres * coef, formula: `${base} € × ${litres.toFixed(3)} L × ${coef}` } }
  }
}

export function pensionRate(valueUah: number): number {
  const pm = rules.pension.subsistenceMinimumUah
  for (const t of rules.pension.tiers) if (t.uptoMultiples === null || valueUah <= t.uptoMultiples * pm) return t.rate
  return 0.05
}

export function calcUkraine(v: Vehicle, i: RouteInput, fx: FxRates, now = new Date()): CalcResult {
  const usd = (x: number) => toEur(x, 'USD', fx)
  const uah = (x: number) => toEur(x, 'UAH', fx)
  const price = toEur(i.purchasePrice, i.purchaseCurrency, fx)
  const items: LineItem[] = []
  const warnings = [] as CalcResult['warnings']
  const customsValue = r(price, price, price * 1.15)
  if (i.origin === 'US') warnings.push(m('warn.uaFreight'))

  let dutyRate = rules.duty.default
  let dutyNote = m('note.dutyNonEu')
  if (v.fuel === 'electric') { dutyRate = rules.duty.electric; dutyNote = m('note.dutyEv') }
  else if (i.origin === 'EU') {
    if (isEuMade(v) && i.hasOriginProof) { dutyRate = rules.duty.euOriginWithProof; dutyNote = m('note.dutyEuOrigin') }
    else if (!isEuMade(v)) { dutyNote = m('note.dutyNotEuMade', { plant: v.plantCountry ?? '—' }); warnings.push(m('warn.dutyNotEuMade')) }
    else warnings.push(m('warn.noOriginProof'))
  }
  const duty = scaleR(customsValue, dutyRate)
  items.push(item('duty', m('line.duty', { rate: dutyRate * 100 }), 'tax', duty, { note: dutyNote, formula: `${dutyRate * 100}% × CV`, source: rules.refs.duty }))

  const ex = exciseUa(v, now)
  const coef = ageCoefUa(v.year, now)
  items.push(item('excise', m('line.excise'), 'tax', fixed(ex.eur), { formula: ex.formula, note: v.fuel === 'electric' ? m('note.uaExciseEv') : v.fuel === 'hybrid' || v.fuel === 'phev' ? m('note.uaExciseHybrid') : m('note.uaExcise', { coef }), source: rules.refs.excise }))

  const vat = scaleR(addR(addR(customsValue, duty), fixed(ex.eur)), rules.vat)
  items.push(item('vat', m('line.vat', { rate: rules.vat * 100 }), 'tax', vat, { formula: '20% × (CV + duty + excise)', source: rules.refs.vat }))

  const pr = pensionRate(customsValue.likely * fx.eurUah)
  const pension = { min: customsValue.min * pensionRate(customsValue.min * fx.eurUah), likely: customsValue.likely * pr, max: customsValue.max * pensionRate(customsValue.max * fx.eurUah) }
  const pm = rules.pension.subsistenceMinimumUah
  items.push(item('pension', m('line.pension', { rate: pr * 100 }), 'tax', pension, { note: m('note.uaPension', { t1: (165 * pm).toLocaleString('uk-UA'), t2: (290 * pm).toLocaleString('uk-UA'), pm }), source: rules.refs.pension }))

  const F = rules.fees
  items.push(item('coc', m('line.uaCoc'), 'fees', scaleR(span(F.certificateOfConformityUsd), usd(1)), { estimate: true, note: m('note.uaCoc'), source: rules.refs.customs }))
  items.push(item('registration', m('line.uaRegistration'), 'fees', scaleR(span(F.registrationUah), uah(1)), { estimate: true, note: m('note.uaRegistration') }))

  const key = i.origin === 'US' ? 'US_to_UA' : i.origin === 'EU' ? 'EU_to_UA' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], mandatory: zero }
  const checklist = [m('chk.uaInvoice'), m(i.origin === 'US' ? 'chk.uaTitle' : 'chk.uaDocs'), m('chk.uaDeclaration'), m('chk.uaRegister')]
  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  return { items, notComputed: [], nuances: nu.list, conversionTotal: zero, warnings, checklist, total: sumItems(items), taxesTotal: taxes, customsValue: customsValue.likely, meta: { ageCoef: coef, dutyRate, pensionRate: pr } }
}
