import type { CalcResult, CountryInfo, Destination, FxRates, LineItem, RouteInput, Vehicle } from '../../types'
import countries from '../../data/countries.json'
import { toEur } from '../fx'
import { addR, fixed, pct, r, scaleR, zero } from '../money'
import { ageYears, isEuMade, item, m, nuancesFor, sumItems } from './common'

export const COUNTRIES = countries.destinations as unknown as Record<Destination, CountryInfo>
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

/**
 * Austrian NoVA (Normverbrauchsabgabe), rates in force from 1 January 2026:
 * rate = (CO2 - 91) / 5, capped at 80%, applied to the purchase price, minus a EUR 350 allowance;
 * plus a CO2 malus of EUR 80 for every gram above 155 g/km. Electric vehicles are exempt.
 */
export function austriaNova(v: Vehicle, baseEur: number): { total: number; rate: number; malus: number; base: number } | null {
  const A = countries.austria
  if (v.fuel === 'electric') return { total: 0, rate: 0, malus: 0, base: baseEur }
  const co2 = v.co2Wltp
  if (!co2) return null
  const rate = Math.min(A.maxRate, Math.max(0, Math.round((co2 - A.co2Deduction2026) / A.divisor) / 100))
  const malus = Math.max(0, co2 - A.malusThreshold) * A.malusPerGram
  const total = Math.max(0, baseEur * rate - A.deductionEur) + malus
  return { total, rate, malus, base: baseEur }
}

/** Generic EU calculation (Spain has its own module): 10% duty + national VAT (+ excise in Poland, NoVA in Austria). */
export function calcEu(v: Vehicle, i: RouteInput, fx: FxRates, now = new Date()): CalcResult {
  const c = COUNTRIES[i.destination]
  const price = toEur(i.purchasePrice, i.purchaseCurrency, fx)
  const items: LineItem[] = []
  const warnings = [] as CalcResult['warnings']
  const nonEu = i.origin !== 'EU'
  const exempt = i.residenceTransfer && nonEu
  const age = ageYears(v, now)
  const cif = r(price, price, price * 1.15)
  const customsSrc = { title: new URL(c.customs).hostname.replace('www.', ''), url: c.customs }

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

  const isNewForVat = (v.mileageKm !== undefined && v.mileageKm < 6000) || age < 0.5
  if (nonEu) {
    const vat = exempt ? zero : scaleR(addR(addR(cif, duty), excise), c.vat)
    items.push(item('vat', m('line.vat', { rate: c.vat * 100 * (exempt ? 0 : 1) }), 'tax', vat, { formula: i.destination === 'PL' ? `${pct(c.vat)} × (CIF + duty + excise)` : `${pct(c.vat)} × (CIF + duty)`, note: exempt ? m('note.relocation') : undefined, source: countries.vatSource }))
  } else {
    items.push(item('vat', m('line.vat', { rate: isNewForVat ? c.vat * 100 : 0 }), 'tax', isNewForVat ? scaleR(fixed(price), c.vat) : zero, { note: m(isNewForVat ? 'note.newVehicleVat' : 'note.usedEuNoVat'), source: countries.vatSource }))
  }

  // ---- registration tax ----
  if (c.regTax === 'computed' && i.destination === 'AT') {
    const nova = exempt ? { total: 0, rate: 0, malus: 0, base: price } : austriaNova(v, price)
    if (nova) {
      items.push(item('regTax', m('line.regTaxAt', { rate: nova.rate * 100 }), 'tax', fixed(nova.total), {
        formula: '(CO₂ − 91) / 5 × price − 350 + malus',
        note: exempt ? m('note.relocation') : v.fuel === 'electric' ? m('note.atNovaEv') : m('note.atNova', { co2: v.co2Wltp ?? 0, rate: nova.rate * 100, malus: Math.round(nova.malus) }),
        source: countries.austria.source,
      }))
    } else {
      items.push(item('regTax', m('line.regTax'), 'tax', zero, { unknown: true, note: m('note.atNovaNoCo2'), source: countries.austria.source }))
      warnings.push(m('warn.atNeedCo2'))
    }
  } else if (c.regTax === 'none') {
    items.push(item('regTax', m('line.regTax'), 'tax', zero, { note: m('note.regTaxNone'), source: countries.regTaxNoneSource }))
  } else if (c.regTax === 'national') {
    items.push(item('regTax', m('line.regTax'), 'tax', zero, { unknown: true, note: m('note.regTaxNational'), source: customsSrc }))
  }

  // ---- registration fees ----
  items.push(item('regFees', m('line.regFees'), 'fees', zero, { unknown: true, note: m('note.regFeesNational'), source: customsSrc }))

  if (exempt) warnings.push(m('warn.relocationConditions'))
  if (v.marketSpec !== 'EU') warnings.push(m('warn.nonEuSpec'))
  if (i.destination === 'DE') warnings.push(m('warn.deNoRegTax'))

  const key = v.marketSpec === 'US' ? 'US_to_EU' : v.marketSpec === 'JP' ? 'JP_to_EU' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], mandatory: zero }
  if (nu.mandatory.max > 0) items.push(item('conversion', m('line.conversionMandatory'), 'fees', nu.mandatory, { estimate: true, note: m('note.conversionMandatory') }))

  const notice = !nonEu && !isNewForVat && c.regTax !== 'computed'
    ? m(c.regTax === 'none' ? 'notice.intraEuNoTax' : 'notice.intraEuUsed')
    : exempt ? m('notice.relocation') : undefined

  const checklist = [m(nonEu ? 'chk.euImport' : 'chk.euIntra'), m('chk.euConformity'), m('chk.euRegister')]
  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  return { items, notComputed: [], nuances: nu.list, conversionTotal: nu.mandatory, notice, warnings, checklist, total: sumItems(items), taxesTotal: taxes, customsValue: cif.likely, meta: { vat: c.vat } }
}
