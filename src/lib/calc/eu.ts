import type { CalcResult, Destination, FxRates, LineItem, RouteInput, Vehicle, CountryInfo } from '../../types'
import countries from '../../data/countries.json'
import { toEur } from '../fx'
import { addR, fixed, pct, r, scaleR, zero } from '../money'
import { ageYears, isEuMade, item, m, nuancesFor, sumItems } from './common'

export const COUNTRIES = countries.destinations as Record<Destination, CountryInfo>
export const EU_DUTY = 0.10

export function polandExciseRate(v: Vehicle): { rate: number; note: string } {
  const R = countries.poland.rates
  const cc = v.engineCc ?? 0
  if (v.fuel === 'electric') return { rate: 0, note: 'ev' }
  if (v.fuel === 'phev' && cc <= 2000) return { rate: 0, note: 'phev' }
  if (v.fuel === 'hybrid' || v.fuel === 'phev') {
    if (cc <= 2000) return { rate: R.hybridUpTo2000, note: 'hybridSmall' }
    if (cc <= 3500) return { rate: R.hybrid2000to3500, note: 'hybridBig' }
    return { rate: R.over2000, note: 'over' }
  }
  return cc > 2000 ? { rate: R.over2000, note: 'over' } : { rate: R.upTo2000, note: 'upTo' }
}

/** Generic EU calculation (Spain has its own module): 10% duty + national VAT (+ excise in Poland). */
export function calcEu(v: Vehicle, i: RouteInput, fx: FxRates, now = new Date()): CalcResult {
  const c = COUNTRIES[i.destination]
  const price = toEur(i.purchasePrice, i.purchaseCurrency, fx)
  const items: LineItem[] = []
  const warnings = [] as CalcResult['warnings']
  const notComputed: CalcResult['notComputed'] = []
  const nonEu = i.origin !== 'EU'
  const exempt = i.residenceTransfer && nonEu
  const age = ageYears(v, now)
  const cif = r(price, price, price * 1.15)
  const customsSrc = { title: `${i.destination} — ${new URL(c.customs).hostname}`, url: c.customs }

  let duty = zero
  if (nonEu) {
    duty = exempt ? zero : scaleR(cif, EU_DUTY)
    items.push(item('duty', m('line.duty', { rate: exempt ? 0 : EU_DUTY * 100 }), 'tax', duty, {
      formula: '10% × CIF',
      note: m(exempt ? 'note.relocation' : isEuMade(v) ? 'note.euMadeReturn' : 'note.dutyNonEu'),
      source: exempt ? { title: 'Reglamento (CE) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32009R1186' } : countries.euDutySource,
    }))
  }

  let excise = zero
  if (i.destination === 'PL') {
    const { rate, note } = polandExciseRate(v)
    const base = nonEu ? addR(cif, duty) : fixed(price)
    excise = scaleR(base, rate)
    items.push(item('excise', m('line.plExcise', { rate: rate * 100 }), 'tax', excise, { formula: nonEu ? `${pct(rate)} × (CIF + duty)` : `${pct(rate)} × price`, note: m(`note.pl.${note}`), source: countries.poland.source }))
  }

  if (nonEu) {
    const vat = exempt ? zero : scaleR(addR(addR(cif, duty), excise), c.vat)
    items.push(item('vat', m('line.vat', { rate: c.vat * 100 * (exempt ? 0 : 1) }), 'tax', vat, { formula: i.destination === 'PL' ? `${pct(c.vat)} × (CIF + duty + excise)` : `${pct(c.vat)} × (CIF + duty)`, note: exempt ? m('note.relocation') : undefined, source: countries.vatSource }))
  } else {
    const isNew = (v.mileageKm !== undefined && v.mileageKm < 6000) || age < 0.5
    items.push(item('vat', m('line.vat', { rate: isNew ? c.vat * 100 : 0 }), 'tax', isNew ? scaleR(fixed(price), c.vat) : zero, { note: m(isNew ? 'note.newVehicleVat' : 'note.usedEuNoVat'), source: countries.vatSource }))
  }

  if (c.registration === 'external') notComputed.push({ key: 'registrationTax', source: customsSrc })
  notComputed.push({ key: 'registrationFees', source: customsSrc })
  if (i.destination === 'DE') warnings.push(m('warn.deNoRegTax'))
  if (exempt) warnings.push(m('warn.relocationConditions'))
  if (v.marketSpec !== 'EU') warnings.push(m('warn.nonEuSpec'))

  const key = v.marketSpec === 'US' ? 'US_to_EU' : v.marketSpec === 'JP' ? 'JP_to_EU' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], mandatory: zero }
  if (nu.mandatory.max > 0) items.push(item('conversion', m('line.conversionMandatory'), 'fees', nu.mandatory, { estimate: true, note: m('note.conversionMandatory') }))
  const checklist = [m(nonEu ? 'chk.euImport' : 'chk.euIntra'), m('chk.euConformity'), m('chk.euRegister')]
  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  return { items, notComputed, nuances: nu.list, conversionTotal: nu.mandatory, warnings, checklist, total: sumItems(items), taxesTotal: taxes, customsValue: cif.likely, meta: { vat: c.vat } }
}
