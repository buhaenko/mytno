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
      return { eur: ex.hybridFlat, formula: `фіксовано ${ex.hybridFlat} € за гібрид` }
    case 'diesel': {
      const base = (v.engineCc ?? 0) > 3500 ? ex.dieselPerLitreOver3500 : ex.dieselPerLitreUpTo3500
      return { eur: base * litres * coef, formula: `${base} € × ${litres.toFixed(3)} л × ${coef} (вік)` }
    }
    default: {
      const base = (v.engineCc ?? 0) > 3000 ? ex.petrolPerLitreOver3000 : ex.petrolPerLitreUpTo3000
      return { eur: base * litres * coef, formula: `${base} € × ${litres.toFixed(3)} л × ${coef} (вік)` }
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
  const items: LineItem[] = []
  const warnings: string[] = []
  const checklist: string[] = []
  const L = rules.logistics

  // ---------- Логістика ----------
  let freightToBorder = zero
  if (i.origin === 'US') {
    if (i.boughtFrom === 'auction') {
      const fee = price * L.us.auctionFeePct + usd(L.us.auctionFixedUsd)
      items.push(item('auction', 'Збори аукціону', 'logistics', r(fee * 0.8, fee, fee * 1.25), { estimate: true, note: 'Залежить від ціни лоту й типу акаунта (брокерський/дилерський).' }))
    }
    const inland = i.usInland === 'far' ? span(L.us.inlandFarUsd) : span(L.us.inlandNearUsd)
    const inlandEur = scaleR(inland, usd(1))
    const ocean = scaleR(span(L.us.oceanUsd), usd(1))
    const handling = scaleR(span(L.us.portHandlingUsd), usd(1))
    const portToUa = scaleR(span(L.us.portToUaUsd), usd(1))
    items.push(item('inland', 'Доставка по США до порту', 'logistics', inlandEur, { estimate: true }))
    items.push(item('ocean', 'Морський фрахт до Європи', 'logistics', ocean, { estimate: true }))
    items.push(item('port', 'Порт, експедитор', 'logistics', handling, { estimate: true }))
    items.push(item('port-ua', 'Порт → Україна', 'logistics', portToUa, { estimate: true }))
    items.push(item('insurance', 'Страхування перевезення', 'logistics', r(0, price * L.us.transitInsurancePct, price * 0.02), { estimate: true }))
    freightToBorder = addR(inlandEur, ocean)
  } else if (i.origin === 'EU') {
    const deliv = i.delivery === 'self' ? span(L.eu.selfDriveEur) : span(L.eu.autovozEur)
    items.push(item('delivery', i.delivery === 'self' ? 'Своїм ходом' : 'Автовоз ЄС → Україна', 'logistics', deliv, { estimate: true }))
    items.push(item('export-plates', 'Транзитні номери', 'logistics', span(L.eu.exportPlatesEur), { estimate: true }))
    if (i.delivery !== 'self') freightToBorder = scaleR(deliv, 0.7)
  } else {
    const ocean = scaleR(r(1500, 2000, 2800), usd(1))
    items.push(item('ocean', 'Морський фрахт до Європи + порт → Україна', 'logistics', ocean, { estimate: true }))
    freightToBorder = ocean
  }

  // ---------- Митна вартість ----------
  const customsValue = r(price, price + freightToBorder.likely, price * 1.15 + freightToBorder.max)
  if (i.origin === 'US') warnings.push('Митна вартість = ціна лоту + доставка до кордону України. Митниця звіряє з власними довідниками: якщо ціна виглядає заниженою, візьмуть вищу («максимум» у розрахунку).')

  // ---------- Мито ----------
  let dutyRate = rules.duty.default
  let dutyNote = 'Ставка 10% для авто не з ЄС (США, Японія, Корея, ОАЕ…).'
  if (v.fuel === 'electric') {
    dutyRate = rules.duty.electric
    dutyNote = 'Електромобілі — мито 0%.'
  } else if (i.origin === 'EU') {
    if (isEuMade(v) && i.hasOriginProof) {
      dutyRate = rules.duty.euOriginWithProof
      dutyNote = 'Авто виготовлене в ЄС, куплене в ЄС, є EUR.1/декларація походження → 0% за Угодою про асоціацію.'
    } else if (!isEuMade(v)) {
      dutyNote = `Куплене в ЄС, але виготовлене не в ЄС (${v.plantCountry ?? 'завод невідомий'}) → преференція не діє, 10%.`
      warnings.push('Мито 0% залежить від країни ВИРОБНИЦТВА, а не покупки. Це авто зібране поза ЄС, тому мито 10%.')
    } else {
      warnings.push('Без EUR.1 або декларації походження на інвойсі мито буде 10%. Попросіть продавця/дилера оформити — для інвойсів до 6 000 € достатньо декларації.')
    }
  }
  const duty = scaleR(customsValue, dutyRate)
  items.push(item('duty', `Ввізне мито ${pct(dutyRate)}`, 'tax', duty, { note: dutyNote, formula: `${pct(dutyRate)} × митна вартість`, source: rules.refs.duty }))

  // ---------- Акциз ----------
  const ex = exciseUa(v, now)
  items.push(item('excise', 'Акцизний податок', 'tax', fixed(ex.eur), { formula: ex.formula, note: v.fuel === 'electric' ? 'З 01.01.2026 пільги на електромобілі скасовані: акциз 1 €/кВт·год, ПДВ 20%.' : 'Ставка в євро за літр × повні роки з року, наступного за роком випуску (мін. 1, макс. 15).', source: rules.refs.excise }))
  if (v.fuel !== 'electric' && v.fuel !== 'hybrid' && v.fuel !== 'phev') {
    warnings.push(`Коефіцієнт віку ${ageCoefUa(v.year, now)}: береться рік ВИРОБНИЦТВА з документів. Для US-авто модельний рік (${v.year}) може бути на 1 більший за фактичний рік випуску — тоді акциз буде більший на один крок.`)
  }

  // ---------- ПДВ ----------
  const vatBase = addR(addR(customsValue, duty), fixed(ex.eur))
  const vat = scaleR(vatBase, rules.vat)
  items.push(item('vat', `ПДВ ${pct(rules.vat)}`, 'tax', vat, { formula: '20% × (митна вартість + мито + акциз)', source: rules.refs.vat }))

  // ---------- Пенсійний збір ----------
  const pension = {
    min: customsValue.min * pensionRate(customsValue.min * fx.eurUah),
    likely: customsValue.likely * pensionRate(customsValue.likely * fx.eurUah),
    max: customsValue.max * pensionRate(customsValue.max * fx.eurUah),
  }
  const pr = pensionRate(customsValue.likely * fx.eurUah)
  items.push(item('pension', `Пенсійний збір ${pct(pr)}`, 'tax', pension, { note: `3% до ${(165 * rules.pension.subsistenceMinimumUah).toLocaleString('uk-UA')} ₴, 4% до ${(290 * rules.pension.subsistenceMinimumUah).toLocaleString('uk-UA')} ₴, 5% вище (прожитковий мінімум 2026 = ${rules.pension.subsistenceMinimumUah} ₴).`, source: rules.refs.pension }))

  // ---------- Збори та послуги ----------
  const F = rules.fees
  items.push(item('broker', 'Митний брокер', 'fees', scaleR(span(F.brokerUsd), usd(1)), { estimate: true, note: 'Ринкова ціна послуги; самостійне декларування через кабінет Держмитслужби — 0.', source: rules.refs.customs }))
  items.push(item('coc', 'Сертифікат відповідності (ОТК)', 'compliance', scaleR(span(F.certificateOfConformityUsd), usd(1)), { estimate: true, note: 'Обов\'язковий для першої реєстрації імпортованого авто. Мінімум Євро-2 для вживаних.', source: rules.refs.customs }))
  if (i.origin === 'EU' || i.origin === 'OTHER') items.push(item('translation', 'Переклад документів', 'fees', scaleR(span(F.translationUah), uah(1)), { estimate: true }))
  items.push(item('registration', 'Реєстрація в СЦ МВС, номери', 'fees', scaleR(span(F.registrationUah), uah(1)), { estimate: true }))
  items.push(item('expert', 'Експертна оцінка', 'fees', scaleR(span(F.expertAssessmentUah, 0), uah(1)), { estimate: true }))

  // ---------- Ремонт ----------
  if (i.salvage && i.repairBudget > 0) {
    items.push(item('repair', 'Ремонт після аукціону (ваш бюджет)', 'repair', r(i.repairBudget * 0.8, i.repairBudget, i.repairBudget * 1.4), { estimate: true, note: 'Реальний ремонт після salvage у 70% випадків виходить дорожчим за план.' }))
  }

  // ---------- Нюанси ----------
  const key = i.origin === 'US' ? 'US_to_UA' : i.origin === 'EU' ? 'EU_to_UA' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], total: zero }

  checklist.push('Інвойс/договір купівлі-продажу (для ЄС — з декларацією походження або EUR.1)')
  checklist.push(i.origin === 'US' ? 'Title (оригінал) + Bill of Sale + коносамент (B/L)' : 'Оригінал техпаспорта (Brief/Zulassung), ключі, сервісна книжка')
  checklist.push('Паспорт + РНОКПП власника, довіреність брокеру')
  checklist.push('Сертифікат відповідності (ОТК) → сервісний центр МВС → перша реєстрація')
  if (v.fuel === 'electric') checklist.push('Підтвердження ємності батареї (для акцизу 1 €/кВт·год)')

  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  const total = sumItems(items)
  return {
    items,
    nuances: nu.list,
    warnings,
    checklist,
    total,
    taxesTotal: taxes,
    customsValue: customsValue.likely,
    meta: { ageCoef: ageCoefUa(v.year, now), dutyRate, pensionRate: pr, priceEur: price },
  }
}
