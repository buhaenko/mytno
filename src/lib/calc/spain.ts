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

/** Фіскальні к.с. (CVF) — груба оцінка за об'ємом для 4–6 циліндрових моторів. */
export function cvfFromCc(cc?: number): number {
  if (!cc) return 6
  return (cc / 1000) * 6.7
}

export function ivtmAnnual(cvf: number): number {
  for (const t of rules.fees.ivtmByCvf) {
    if (t.maxCvf === null || cvf < t.maxCvf) return t.eur
  }
  return 224
}

export function calcSpain(v: Vehicle, i: RouteInput, fx: FxRates, now = new Date()): CalcResult {
  const usd = (x: number) => toEur(x, 'USD', fx)
  const price = toEur(i.purchasePrice, i.purchaseCurrency, fx)
  const items: LineItem[] = []
  const warnings: string[] = []
  const checklist: string[] = []
  const L = rules.logistics
  const nonEuOrigin = i.origin !== 'EU'
  const age = ageYears(v, now)

  // ---------- Логістика ----------
  let freightToBorder = zero
  if (i.origin === 'UA') {
    const deliv = i.delivery === 'self' ? span(L.uaToEs.selfDriveEur) : span(L.uaToEs.autovozEur)
    items.push(item('delivery', i.delivery === 'self' ? 'Перегін своїм ходом Україна → Іспанія (~3 000 км: пальне, платні дороги, 2 ночівлі)' : 'Автовоз Україна → Іспанія', 'logistics', deliv, { estimate: true }))
    if (i.delivery === 'self') items.push(item('greencard', 'Зелена карта на українське авто (1–2 міс)', 'logistics', span(L.uaToEs.greenCardEur), { estimate: true }))
    freightToBorder = i.delivery === 'self' ? r(0, 150, 300) : scaleR(deliv, 0.5)
  } else if (i.origin === 'EU') {
    const deliv = i.delivery === 'self' ? span(L.euToEs.selfDriveEur) : span(L.euToEs.autovozEur)
    items.push(item('delivery', i.delivery === 'self' ? 'Перегін своїм ходом (транзитні номери, пальне, дороги)' : 'Автовоз ЄС → Іспанія', 'logistics', deliv, { estimate: true }))
  } else if (i.origin === 'US') {
    if (i.boughtFrom === 'auction') {
      const fee = price * L.usToEs.auctionFeePct + usd(L.usToEs.auctionFixedUsd)
      items.push(item('auction', 'Збори аукціону (Copart/IAAI)', 'logistics', r(fee * 0.8, fee, fee * 1.25), { estimate: true }))
    }
    const inland = scaleR(i.usInland === 'far' ? span(L.usToEs.inlandFarUsd) : span(L.usToEs.inlandNearUsd), usd(1))
    const ocean = scaleR(span(L.usToEs.oceanUsd), usd(1))
    items.push(item('inland', 'Доставка по США до порту', 'logistics', inland, { estimate: true }))
    items.push(item('ocean', 'Морський фрахт до Валенсії/Барселони/Більбао (RoRo або контейнер)', 'logistics', ocean, { estimate: true }))
    items.push(item('port', 'Портовий агент, вивантаження, T1/DUA', 'logistics', span(L.usToEs.portAgentEur), { estimate: true }))
    items.push(item('insurance', 'Страхування перевезення (опційно)', 'logistics', r(0, price * L.usToEs.transitInsurancePct, price * 0.02), { estimate: true }))
    freightToBorder = addR(inland, ocean)
  } else {
    const ocean = scaleR(r(1500, 2200, 3000), usd(1))
    items.push(item('ocean', 'Морський фрахт до Іспанії + агент', 'logistics', ocean, { estimate: true }))
    freightToBorder = ocean
  }

  // ---------- Митна вартість (CIF) ----------
  const cif = r(price, price + freightToBorder.likely, price * 1.15 + freightToBorder.max)

  // ---------- Мито та IVA ----------
  const exempt = i.residenceTransfer
  if (nonEuOrigin) {
    const duty = exempt ? zero : scaleR(cif, rules.duty)
    items.push(item('duty', `Мито (arancel) ${exempt ? '0% — пільга при переїзді' : pct(rules.duty)}`, 'tax', duty, {
      formula: '10% × CIF (ціна + доставка + страховка до кордону ЄС)',
      note: isEuMade(v) ? 'Авто зроблене в ЄС, але «повернення товару» без мита діє лише протягом 3 років після вивозу з ЄС — практично не застосовується.' : undefined,
    }))
    const vat = exempt ? zero : scaleR(addR(cif, duty), rules.vat)
    items.push(item('vat', `IVA при імпорті ${exempt ? '0% — пільга при переїзді' : pct(rules.vat)}`, 'tax', vat, { formula: '21% × (CIF + мито)', note: 'Канари: IGIC 7% замість IVA; Сеута/Мелілья: IPSI.' }))
  } else {
    const isNew = (v.mileageKm !== undefined && v.mileageKm < 6000) || age < 0.5
    if (isNew) {
      items.push(item('vat', 'IVA 21% (авто «нове» для ПДВ: < 6 міс або < 6 000 км)', 'tax', scaleR(fixed(price), rules.vat), { note: 'Для нових авто з ЄС ПДВ платиться в Іспанії, навіть якщо вже сплачений у країні покупки (потім повертається там).' }))
    } else {
      items.push(item('vat', 'IVA: не платиться (вживане авто з ЄС)', 'tax', zero, { note: 'Куплене у приватника або у дилера за схемою маржі (REBU) — додаткового ПДВ немає.' }))
    }
  }

  // ---------- Impuesto de matriculación (IEDMT) ----------
  const knownCo2 = v.co2Wltp !== undefined && v.co2Wltp > 0
  const isUsSpec = v.marketSpec === 'US' || v.marketSpec === 'JP' || v.marketSpec === 'KR' || v.marketSpec === 'OTHER'
  const rateLikely = isUsSpec ? rules.iedmt.unknownCo2Rate : iedmtRate(knownCo2 ? v.co2Wltp : undefined)
  const rateMin = knownCo2 ? iedmtRate(v.co2Wltp) : rateLikely
  const dep = depreciation(age)
  let base = { min: 0, likely: 0, max: 0 }
  let baseNote: string
  if (v.listPriceNewEur && v.listPriceNewEur > 0) {
    const gross = v.listPriceNewEur * dep
    base = {
      min: gross / (1 + rules.vat + rateMin),
      likely: gross / (1 + rules.vat + rateLikely),
      max: gross,
    }
    baseNote = `Ціна нового за таблицями Hacienda ≈ ${Math.round(v.listPriceNewEur).toLocaleString('uk-UA')} € × ${pct(dep)} (вік ${age.toFixed(1)} р.), мінус IVA та IEDMT, що «сидять» у табличній ціні. Точну базу дає сервіс AEAT «Valoración de vehículos».`
  } else {
    base = { min: price * 0.9, likely: price, max: price * 1.3 }
    baseNote = 'Ціна нового невідома — базою взято ринкову вартість (ваша ціна). Hacienda може застосувати свої таблиці; вкажіть ціну нового для точності.'
  }
  const iedmt = exempt
    ? zero
    : { min: base.min * rateMin, likely: base.likely * rateLikely, max: base.max * rateLikely }
  const co2Label = exempt
    ? '0% — пільга при переїзді'
    : isUsSpec
      ? `${pct(rateLikely)} (CO₂ не сертифіковано в ЄС${knownCo2 ? `; якщо лабораторія впише ${v.co2Wltp} г/км WLTP → ${pct(rateMin)}` : ''})`
      : `${pct(rateLikely)} за CO₂ ${knownCo2 ? `${v.co2Wltp} г/км WLTP` : 'невідомо → максимальна ставка'}`
  items.push(item('iedmt', `Impuesto de matriculación ${co2Label}`, 'tax', iedmt, { formula: 'ставка за CO₂ × база (таблична ціна × коефіцієнт віку)', note: baseNote }))
  if (isUsSpec && !exempt) warnings.push('Для авто без європейської сертифікації CO₂ Hacienda застосовує максимальну ставку 14,75%. Лабораторія при омологації іноді вписує WLTP європейського аналога — тоді ставка нижча.')
  if (!knownCo2 && !isUsSpec) warnings.push('Вкажіть CO₂ (WLTP, з COC або техпаспорта): без нього рахуємо максимальну ставку 14,75%.')
  if (exempt) warnings.push('Пільга «traslado de residencia»: авто у власності ≥ 6 міс до переїзду, ви жили поза ЄС ≥ 12 міс, ввезення протягом 12 міс після зміни резиденції, заборона продажу 12 міс. Якщо ви ВЖЕ резидент Іспанії (у т. ч. тимчасовий захист) і купуєте авто зараз — пільга не діє.')

  // ---------- Омологація / ITV / DGT ----------
  const F = rules.fees
  if (v.marketSpec === 'EU') {
    items.push(item('coc', 'COC від виробника (сертифікат відповідності ЄС)', 'compliance', span(F.cocFromManufacturerEur), { estimate: true, note: 'Замовляється у дилера/виробника за VIN. Якщо є оригінальний COC — 0 €.' }))
    items.push(item('ficha', 'Ficha técnica reducida + ITV імпортного авто', 'compliance', addR(span(F.fichaReducidaEur), span(F.itvImportEur)), { estimate: true }))
  } else {
    items.push(item('homolog', 'Індивідуальна омологація (лабораторія + ficha reducida + інспекція ITV)', 'compliance', span(F.individualHomologationEur), { estimate: true, note: 'Обов\'язкова для авто без європейського типового схвалення (US/JP/KR-версії). Термін 3–8 тижнів.' }))
    items.push(item('itv', 'ITV імпортного авто', 'compliance', span(F.itvImportEur), { estimate: true }))
  }
  items.push(item('dgt', 'Tasa DGT 1.1 (матрікуляція)', 'fees', fixed(F.dgtTasaEur)))
  items.push(item('plates', 'Номерні знаки', 'fees', span(F.platesEur), { estimate: true }))
  items.push(item('gestoria', 'Gestoría (оформлення під ключ)', 'fees', span(F.gestoriaEur), { estimate: true, note: 'Можна зробити самому через sede.dgt.gob.es і AEAT (модель 576) — тоді 0 €.' }))
  const cvf = cvfFromCc(v.engineCc)
  const ivtm = v.fuel === 'electric' ? ivtmAnnual(cvf) * 0.25 : ivtmAnnual(cvf)
  items.push(item('ivtm', `IVTM (щорічний муніципальний податок, ≈${cvf.toFixed(1)} фіск. к.с.)`, 'fees', r(ivtm * 0.6, ivtm, ivtm * 1.2), { estimate: true, note: 'Залежить від муніципалітету; у перший рік пропорційно кварталам. Електро/гібриди мають знижки до 75% у багатьох містах.' }))

  // ---------- Переобладнання ----------
  const key = v.marketSpec === 'US' ? 'US_to_EU' : v.marketSpec === 'JP' ? 'JP_to_EU' : ''
  const nu = key ? nuancesFor(key, v.brandTier) : { list: [], total: zero }
  if (key) items.push(item('conversion', 'Переобладнання під норми ЄС (світло, спідометр, тонування)', 'compliance', nu.total, { estimate: true, note: 'Деталі нижче в «Нюансах». Мінімум = лише обов\'язкове, максимум = усе нове оригінальне.' }))

  // ---------- Ремонт ----------
  if (i.salvage && i.repairBudget > 0) {
    items.push(item('repair', 'Ремонт після аукціону (ваш бюджет)', 'repair', r(i.repairBudget * 0.8, i.repairBudget, i.repairBudget * 1.4), { estimate: true }))
  }

  // ---------- Попередження ----------
  if (v.marketSpec === 'JP') warnings.push('Праве кермо в Іспанії реєструють, але потрібні фари під правосторонній рух і індивідуальна омологація.')
  if (i.origin === 'UA') warnings.push('Резидент Іспанії має почати реєстрацію протягом 30 днів після ввезення; їздити на українських номерах резиденту не можна.')
  if (age > 25) warnings.push('Авто старше 25–30 років можна оформити як «histórico» з меншими податками та без омологації.')

  checklist.push(nonEuOrigin ? 'DUA (митна декларація) через агента, сплата мита та IVA — отримати «justificante» для DGT' : 'Договір купівлі та іноземний техпаспорт (оригінал)')
  checklist.push(v.marketSpec === 'EU' ? 'COC або ficha técnica reducida → ITV → ficha técnica española' : 'Лабораторія (homologación individual) → ITV → ficha técnica española')
  checklist.push('Modelo 576 (IEDMT) в AEAT або заява про звільнення (Modelo 06)')
  checklist.push('IVTM (сплата/пропорція в ayuntamiento) → DGT: tasa 1.1, permiso de circulación → номери')
  checklist.push('Страхування ОСЦПВ (seguro a terceros) на новий номер')

  const taxes = sumItems(items.filter((x) => x.category === 'tax'))
  const total = sumItems(items)
  return {
    items,
    nuances: nu.list,
    warnings,
    checklist,
    total,
    taxesTotal: taxes,
    customsValue: cif.likely,
    meta: { iedmtRate: rateLikely, depreciation: dep, ageYears: Number(age.toFixed(1)), cvf: Number(cvf.toFixed(1)), priceEur: price },
  }
}
