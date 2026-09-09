import type { CalcResult, FxRates, LineItem, RouteInput, Vehicle } from '../../types'
import rules from '@config/rules.spain.json'
import { toEur } from '../fx'
import { addR, fixed, r, scaleR, span, zero } from '../money'
import { ageYears, isEuMade, item, m, nuancesFor, sumItems } from './common'

export function iedmtRate(co2?: number): number {
  if (co2 === undefined || co2 === null || Number.isNaN(co2)) return rules.iedmt.unknownCo2Rate
  for (const b of rules.iedmt.brackets) if (b.maxCo2 === null || co2 < b.maxCo2) return b.rate
  return rules.iedmt.unknownCo2Rate
}

export function depreciation(age: number): number {
  for (const d of rules.iedmt.depreciation) if (d.maxYears === null || age <= d.maxYears) return d.pct
  return 0.1
}

export function calcSpain(v: Vehicle, i: RouteInput, fx: FxRates, now = new Date()): CalcResult {
  const price = toEur(i.purchasePrice, i.purchaseCurrency, fx)
  const items: LineItem[] = []
  const warnings = [] as CalcResult['warnings']
  const nonEu = i.origin !== 'EU'
  const age = ageYears(v, now)
  const exempt = i.residenceTransfer && nonEu
  const cif = r(price, price, price * 1.15)
  const relocationSrc = rules.refs.franquicia

  if (nonEu) {
    const duty = exempt ? zero : scaleR(cif, rules.duty)
    items.push(item('duty', m('line.duty', { rate: exempt ? 0 : rules.duty * 100 }), 'tax', duty, { formula: '10% × CIF', note: exempt ? m('note.relocation') : isEuMade(v) ? m('note.euMadeReturn') : m('note.dutyNonEu'), source: exempt ? relocationSrc : rules.refs.duty }))
    const vat = exempt ? zero : scaleR(addR(cif, duty), rules.vat)
    items.push(item('vat', m('line.iva', { rate: exempt ? 0 : rules.vat * 100 }), 'tax', vat, { formula: '21% × (CIF + duty)', note: exempt ? m('note.relocation') : m('note.esCanarias'), source: exempt ? relocationSrc : rules.refs.vat }))
  } else {
    const isNew = (v.mileageKm !== undefined && v.mileageKm < 6000) || age < 0.5
    items.push(item('vat', m('line.iva', { rate: isNew ? rules.vat * 100 : 0 }), 'tax', isNew ? scaleR(fixed(price), rules.vat) : zero, { note: m(isNew ? 'note.newVehicleVat' : 'note.usedEuNoVat'), source: rules.refs.dgtEu }))
  }

  const knownCo2 = v.co2Wltp !== undefined && v.co2Wltp > 0
  const nonEuSpec = v.marketSpec !== 'EU'
  const rateLikely = nonEuSpec ? rules.iedmt.unknownCo2Rate : iedmtRate(knownCo2 ? v.co2Wltp : undefined)
  const rateMin = knownCo2 ? iedmtRate(v.co2Wltp) : rateLikely
  const dep = depreciation(age)
  let base: { min: number; likely: number; max: number }
  let baseNote
  if (v.listPriceNewEur && v.listPriceNewEur > 0) {
    const gross = v.listPriceNewEur * dep
    base = { min: gross / (1 + rules.vat + rateMin), likely: gross / (1 + rules.vat + rateLikely), max: gross }
    baseNote = m('note.iedmtBaseTable', { list: Math.round(v.listPriceNewEur).toLocaleString('uk-UA'), dep: Math.round(dep * 100), age: age.toFixed(1) })
  } else {
    base = { min: price * 0.9, likely: price, max: price * 1.3 }
    baseNote = m('note.iedmtBasePrice')
  }
  const iedmt = exempt ? zero : { min: base.min * rateMin, likely: base.likely * rateLikely, max: base.max * rateLikely }
  const co2Note = exempt ? m('note.relocation') : nonEuSpec ? m(knownCo2 ? 'note.iedmtNoCertCo2Alt' : 'note.iedmtNoCert', { rate: rateLikely * 100, co2: v.co2Wltp ?? 0, alt: rateMin * 100 }) : m('note.iedmtCo2', { co2: knownCo2 ? String(v.co2Wltp) : '—', rate: rateLikely * 100 })
  items.push(item('iedmt', m('line.iedmt', { rate: exempt ? 0 : rateLikely * 100 }), 'tax', iedmt, { formula: 'rate(CO₂) × base', note: m('note.join', { a: co2Note.key, b: baseNote.key }), source: rules.refs.iedmt }))
  // 'join' is a special key: the UI concatenates two messages whose params are passed separately
  items[items.length - 1]!.note = { key: 'join', params: { a: JSON.stringify(co2Note), b: JSON.stringify(baseNote) } }
  if (nonEuSpec && !exempt) warnings.push(m('warn.esNoCertCo2'))
  if (!knownCo2 && !nonEuSpec) warnings.push(m('warn.esEnterCo2'))
  if (exempt) warnings.push(m('warn.relocationConditions'))

  const F = rules.fees
  if (v.marketSpec === 'EU') {
    items.push(item('coc', m('line.esCoc'), 'fees', span(F.cocFromManufacturerEur), { estimate: true, note: m('note.esCoc'), source: rules.refs.dgtEu }))
    items.push(item('ficha', m('line.esFicha'), 'fees', addR(span(F.fichaReducidaEur), span(F.itvImportEur)), { estimate: true, note: m('note.esFicha'), source: rules.refs.dgtEu }))
  } else {
    items.push(item('homolog', m('line.esHomolog'), 'fees', span(F.individualHomologationEur), { estimate: true, note: m('note.esHomolog'), source: rules.refs.homolog }))
    items.push(item('itv', m('line.esItv'), 'fees', span(F.itvImportEur), { estimate: true, note: m('note.esItv'), source: rules.refs.dgtNonEu }))
  }
  items.push(item('dgt', m('line.esDgt'), 'fees', fixed(F.dgtTasaEur), { source: rules.refs.dgtTasa }))
  items.push(item('plates', m('line.plates'), 'fees', span(F.platesEur), { estimate: true }))

  const notice = !nonEu && !((v.mileageKm !== undefined && v.mileageKm < 6000) || age < 0.5) ? m('notice.intraEuUsed') : exempt ? m('notice.relocation') : undefined
  const key = v.marketSpec === 'US' ? 'US_to_EU' : v.marketSpec === 'JP' ? 'JP_to_EU' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], mandatory: zero }
  if (nu.mandatory.max > 0) items.push(item('conversion', m('line.conversionMandatory'), 'fees', nu.mandatory, { estimate: true, note: m('note.conversionMandatory') }))
  if (v.marketSpec === 'JP') warnings.push(m('warn.rhd'))
  if (i.origin === 'UA') warnings.push(m('warn.esResident30days'))

  const checklist = [m(nonEu ? 'chk.esDua' : 'chk.euIntra'), m(v.marketSpec === 'EU' ? 'chk.esCocPath' : 'chk.esLabPath'), m('chk.es576'), m('chk.esDgt')]
  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  return { items, notComputed: [], nuances: nu.list, conversionTotal: nu.mandatory, notice, warnings, checklist, total: sumItems(items), taxesTotal: taxes, customsValue: cif.likely, meta: { iedmtRate: rateLikely, depreciation: dep, ageYears: Number(age.toFixed(1)) } }
}
