import type { CalcResult, FxRates, LineItem, RouteInput, Vehicle } from '../../types'
import rules from '../../data/rules.ukraine.json'
import { toEur } from '../fx'
import { addR, fixed, pct, r, scaleR, span, zero } from '../money'
import { isEuMade, item, nuancesFor, sumItems } from './common'

export function ageCoefUa(year: number, now = new Date()): number {
  const raw = now.getFullYear() - year - 1
  return Math.min(rules.excise.ageCoefMax, Math.max(rules.excise.ageCoefMin, raw))
}

export function exciseUa(v: Vehicle, now = new Date()): { eur: number; formula: string } {
  const ex = rules.excise
  const coef = ageCoefUa(v.year, now)
  const litres = (v.engineCc ?? 0) / 1000
  switch (v.fuel) {
    case 'electric': {
      const kwh = v.batteryKwh ?? 0
      return { eur: kwh * ex.electricPerKwh, formula: `${ex.electricPerKwh} € × ${kwh} кВт·год` }
    }
    case 'hybrid':
    case 'phev':
      return { eur: ex.hybridFlat, formula: `фіксовано ${ex.hybridFlat} €` }
    case 'diesel': {
      const base = (v.engineCc ?? 0) > 3500 ? ex.dieselPerLitreOver3500 : ex.dieselPerLitreUpTo3500
      return { eur: base * litres * coef, formula: `${base} € × ${litres.toFixed(3)} л × ${coef}` }
    }
    default: {
      const base = (v.engineCc ?? 0) > 3000 ? ex.petrolPerLitreOver3000 : ex.petrolPerLitreUpTo3000
      return { eur: base * litres * coef, formula: `${base} € × ${litres.toFixed(3)} л × ${coef}` }
    }
  }
}

export function pensionRate(valueUah: number): number {
  const pm = rules.pension.subsistenceMinimumUah
  for (const t of rules.pension.tiers) {
    if (t.uptoMultiples === null || valueUah <= t.uptoMultiples * pm) return t.rate
  }
  return 0.05
}

export function calcUkraine(v: Vehicle, i: RouteInput, fx: FxRates, now = new Date()): CalcResult {
  const usd = (x: number) => toEur(x, 'USD', fx)
  const uah = (x: number) => toEur(x, 'UAH', fx)
  const price = toEur(i.purchasePrice, i.purchaseCurrency, fx)
  const freight = toEur(i.freightToBorder || 0, i.purchaseCurrency, fx)
  const items: LineItem[] = []
  const warnings: string[] = []

  // митна вартість: ціна + доставка до кордону; максимум — митниця переоцінила на 15%
  const customsValue = r(price + freight, price + freight, (price + freight) * 1.15)
  if (i.origin === 'US' && !freight) warnings.push('Для авто зі США митна вартість включає доставку до кордону України. Додайте її в поле «Доставка до кордону», інакше податки будуть занижені.')

  let dutyRate = rules.duty.default
  let dutyNote = 'Ставка 10% для авто не з ЄС.'
  if (v.fuel === 'electric') {
    dutyRate = rules.duty.electric
    dutyNote = 'Електромобілі: 0%.'
  } else if (i.origin === 'EU') {
    if (isEuMade(v) && i.hasOriginProof) {
      dutyRate = rules.duty.euOriginWithProof
      dutyNote = 'Зібране в ЄС, куплене в ЄС, є EUR.1/декларація походження → 0% за Угодою про асоціацію.'
    } else if (!isEuMade(v)) {
      dutyNote = `Куплене в ЄС, але зібране не в ЄС (${v.plantCountry ?? 'завод невідомий'}) → 10%.`
      warnings.push('Мито 0% залежить від країни виробництва, а не покупки. Це авто зібране поза ЄС, тому 10%.')
    } else {
      warnings.push('Без EUR.1 або декларації походження на інвойсі мито 10%. Для інвойсів до 6 000 € достатньо декларації продавця.')
    }
  }
  const duty = scaleR(customsValue, dutyRate)
  items.push(item('duty', `Мито ${pct(dutyRate)}`, 'tax', duty, { note: dutyNote, formula: `${pct(dutyRate)} × митна вартість`, source: rules.refs.duty }))

  const ex = exciseUa(v, now)
  items.push(item('excise', 'Акциз', 'tax', fixed(ex.eur), { formula: ex.formula, note: v.fuel === 'electric' ? 'З 01.01.2026 пільги на електромобілі скасовані: акциз 1 €/кВт·год і ПДВ 20%.' : `Ставка в € за літр × повні роки з року, наступного за роком випуску (коефіцієнт ${ageCoefUa(v.year, now)}, мін. 1, макс. 15). Береться рік виробництва з документів: для US-авто модельний рік може бути на 1 більший за фактичний.`, source: rules.refs.excise }))

  const vat = scaleR(addR(addR(customsValue, duty), fixed(ex.eur)), rules.vat)
  items.push(item('vat', `ПДВ ${pct(rules.vat)}`, 'tax', vat, { formula: '20% × (митна вартість + мито + акциз)', source: rules.refs.vat }))

  const pr = pensionRate(customsValue.likely * fx.eurUah)
  const pension = {
    min: customsValue.min * pensionRate(customsValue.min * fx.eurUah),
    likely: customsValue.likely * pr,
    max: customsValue.max * pensionRate(customsValue.max * fx.eurUah),
  }
  items.push(item('pension', `Пенсійний збір ${pct(pr)}`, 'tax', pension, { note: `При першій реєстрації: 3% до ${(165 * rules.pension.subsistenceMinimumUah).toLocaleString('uk-UA')} ₴, 4% до ${(290 * rules.pension.subsistenceMinimumUah).toLocaleString('uk-UA')} ₴, 5% вище (прожитковий мінімум 2026 = ${rules.pension.subsistenceMinimumUah} ₴).`, source: rules.refs.pension }))

  const F = rules.fees
  items.push(item('coc', 'Сертифікат відповідності', 'fees', scaleR(span(F.certificateOfConformityUsd), usd(1)), { estimate: true, note: 'Обов\'язковий для першої реєстрації імпортованого авто (ОТК). Мінімум Євро-2 для вживаних.', source: rules.refs.customs }))
  items.push(item('registration', 'Реєстрація в СЦ МВС, номери', 'fees', scaleR(span(F.registrationUah), uah(1)), { estimate: true, note: 'Послуги сервісного центру МВС, бланк свідоцтва, номерні знаки.' }))

  const key = i.origin === 'US' ? 'US_to_UA' : i.origin === 'EU' ? 'EU_to_UA' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], total: zero }

  const checklist = [
    'Інвойс/договір купівлі-продажу (для ЄС — з декларацією походження або EUR.1)',
    i.origin === 'US' ? 'Title (оригінал), Bill of Sale, коносамент' : 'Оригінал техпаспорта, ключі',
    'Митна декларація (брокер або кабінет Держмитслужби), сплата мита, акцизу, ПДВ',
    'Сертифікат відповідності → СЦ МВС → пенсійний збір → перша реєстрація',
  ]
  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  return { items, nuances: nu.list, warnings, checklist, total: sumItems(items), taxesTotal: taxes, customsValue: customsValue.likely, meta: { ageCoef: ageCoefUa(v.year, now), dutyRate, pensionRate: pr } }
}
