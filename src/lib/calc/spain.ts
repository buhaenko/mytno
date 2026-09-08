import type { CalcResult, FxRates, LineItem, RouteInput, Vehicle } from '../../types'
import rules from '../../data/rules.spain.json'
import { toEur } from '../fx'
import { addR, fixed, pct, r, scaleR, span, zero } from '../money'
import { ageYears, isEuMade, item, nuancesFor, sumItems } from './common'

export function iedmtRate(co2?: number): number {
  if (co2 === undefined || co2 === null || Number.isNaN(co2)) return rules.iedmt.unknownCo2Rate
  for (const b of rules.iedmt.brackets) {
    if (b.maxCo2 === null || co2 < b.maxCo2) return b.rate
  }
  return rules.iedmt.unknownCo2Rate
}

export function depreciation(age: number): number {
  for (const d of rules.iedmt.depreciation) {
    if (d.maxYears === null || age <= d.maxYears) return d.pct
  }
  return 0.1
}

export function calcSpain(v: Vehicle, i: RouteInput, fx: FxRates, now = new Date()): CalcResult {
  const price = toEur(i.purchasePrice, i.purchaseCurrency, fx)
  const freight = toEur(i.freightToBorder || 0, i.purchaseCurrency, fx)
  const items: LineItem[] = []
  const warnings: string[] = []
  const nonEuOrigin = i.origin !== 'EU'
  const age = ageYears(v, now)
  const exempt = i.residenceTransfer && nonEuOrigin

  const cif = r(price + freight, price + freight, (price + freight) * 1.15)

  if (nonEuOrigin) {
    const duty = exempt ? zero : scaleR(cif, rules.duty)
    items.push(item('duty', `Мито ${exempt ? '0%' : pct(rules.duty)}`, 'tax', duty, {
      formula: '10% × CIF (ціна + доставка та страховка до кордону ЄС)',
      note: exempt ? 'Пільга при переїзді.' : isEuMade(v) ? 'Авто зроблене в ЄС, але «повернення товару» без мита діє лише 3 роки після вивозу з ЄС.' : undefined,
      source: exempt ? rules.refs.franquicia : rules.refs.duty,
    }))
    const vat = exempt ? zero : scaleR(addR(cif, duty), rules.vat)
    items.push(item('vat', `IVA ${exempt ? '0%' : pct(rules.vat)}`, 'tax', vat, { formula: '21% × (CIF + мито)', note: exempt ? 'Пільга при переїзді.' : 'Канари: IGIC 7% замість IVA.', source: exempt ? rules.refs.franquicia : rules.refs.vat }))
  } else {
    const isNew = (v.mileageKm !== undefined && v.mileageKm < 6000) || age < 0.5
    items.push(item('vat', isNew ? 'IVA 21% (нове авто)' : 'IVA 0%', 'tax', isNew ? scaleR(fixed(price), rules.vat) : zero, {
      note: isNew ? 'Авто «нове» для ПДВ (< 6 міс або < 6 000 км): IVA платиться в Іспанії.' : 'Вживане авто з ЄС: додаткового ПДВ немає.',
      source: rules.refs.dgtEu,
    }))
  }

  const knownCo2 = v.co2Wltp !== undefined && v.co2Wltp > 0
  const isUsSpec = v.marketSpec !== 'EU'
  const rateLikely = isUsSpec ? rules.iedmt.unknownCo2Rate : iedmtRate(knownCo2 ? v.co2Wltp : undefined)
  const rateMin = knownCo2 ? iedmtRate(v.co2Wltp) : rateLikely
  const dep = depreciation(age)
  let base: { min: number; likely: number; max: number }
  let baseNote: string
  if (v.listPriceNewEur && v.listPriceNewEur > 0) {
    const gross = v.listPriceNewEur * dep
    base = { min: gross / (1 + rules.vat + rateMin), likely: gross / (1 + rules.vat + rateLikely), max: gross }
    baseNote = `База: ціна нового ${Math.round(v.listPriceNewEur).toLocaleString('uk-UA')} € × ${pct(dep)} (вік ${age.toFixed(1)} р.) без IVA та IEDMT, що входять у табличну ціну. Точну базу дає сервіс AEAT «Valoración de vehículos».`
  } else {
    base = { min: price * 0.9, likely: price, max: price * 1.3 }
    baseNote = 'Ціна нового невідома — базою взято вашу ціну. Hacienda може застосувати свої таблиці; вкажіть ціну нового для точності.'
  }
  const iedmt = exempt ? zero : { min: base.min * rateMin, likely: base.likely * rateLikely, max: base.max * rateLikely }
  const co2Note = exempt ? 'Пільга при переїзді.' : isUsSpec ? `CO₂ не сертифіковано в ЄС → ${pct(rateLikely)}.${knownCo2 ? ` Якщо лабораторія впише ${v.co2Wltp} г/км WLTP → ${pct(rateMin)}.` : ''}` : `CO₂ ${knownCo2 ? `${v.co2Wltp} г/км WLTP` : 'невідомо'} → ${pct(rateLikely)}.`
  items.push(item('iedmt', `Impuesto de matriculación ${exempt ? '0%' : pct(rateLikely)}`, 'tax', iedmt, { formula: 'ставка за CO₂ × база', note: `${co2Note} ${baseNote}`, source: rules.refs.iedmt }))
  if (isUsSpec && !exempt) warnings.push('Без європейської сертифікації CO₂ Hacienda застосовує 14,75%. Лабораторія при омологації іноді вписує WLTP європейського аналога — тоді ставка нижча.')
  if (!knownCo2 && !isUsSpec) warnings.push('Вкажіть CO₂ (WLTP з COC або техпаспорта): без нього рахуємо 14,75%.')
  if (exempt) warnings.push('Пільга діє, лише якщо авто у власності ≥ 6 міс до переїзду, ви жили поза ЄС ≥ 12 міс і ввозите протягом 12 міс після зміни резиденції. Якщо ви вже резидент Іспанії і купуєте зараз — не діє.')

  const F = rules.fees
  if (v.marketSpec === 'EU') {
    items.push(item('coc', 'COC', 'fees', span(F.cocFromManufacturerEur), { estimate: true, note: 'Сертифікат відповідності ЄС від виробника за VIN. Якщо є оригінал — 0 €.', source: rules.refs.dgtEu }))
    items.push(item('ficha', 'Ficha reducida + ITV', 'fees', addR(span(F.fichaReducidaEur), span(F.itvImportEur)), { estimate: true, note: 'Ficha técnica reducida від інженера/лабораторії + ITV імпортного авто (тарифи автономії).', source: rules.refs.dgtEu }))
  } else {
    items.push(item('homolog', 'Індивідуальна омологація', 'fees', span(F.individualHomologationEur), { estimate: true, note: 'Лабораторія + ficha técnica reducida + інспекція ITV. Обов\'язкова для авто без європейського типового схвалення. 3–8 тижнів.', source: rules.refs.homolog }))
    items.push(item('itv', 'ITV', 'fees', span(F.itvImportEur), { estimate: true, note: 'Тариф залежить від автономії.', source: rules.refs.dgtNonEu }))
  }
  items.push(item('dgt', 'Tasa DGT 1.1', 'fees', fixed(F.dgtTasaEur), { source: rules.refs.dgtTasa }))
  items.push(item('plates', 'Номерні знаки', 'fees', span(F.platesEur), { estimate: true }))

  const key = v.marketSpec === 'US' ? 'US_to_EU' : v.marketSpec === 'JP' ? 'JP_to_EU' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], total: zero }
  if (v.marketSpec === 'JP') warnings.push('Праве кермо в Іспанії реєструють, але потрібні фари під правосторонній рух.')
  if (i.origin === 'UA') warnings.push('Резидент Іспанії має почати реєстрацію протягом 30 днів після ввезення.')

  const checklist = [
    nonEuOrigin ? 'DUA через митного агента, сплата мита та IVA' : 'Договір купівлі та іноземний техпаспорт',
    v.marketSpec === 'EU' ? 'COC або ficha reducida → ITV → ficha técnica española' : 'Лабораторія (homologación individual) → ITV → ficha técnica española',
    'Modelo 576 (IEDMT) в AEAT або заява про звільнення (Modelo 06)',
    'IVTM в ayuntamiento → DGT: tasa 1.1, permiso de circulación → номери',
  ]
  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  return { items, nuances: nu.list, warnings, checklist, total: sumItems(items), taxesTotal: taxes, customsValue: cif.likely, meta: { iedmtRate: rateLikely, depreciation: dep, ageYears: Number(age.toFixed(1)) } }
}
