<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Currency, Destination, FxRates, Origin, RouteInput, Vehicle } from './types'
import { loadFx } from './lib/fx'
import { calculate } from './lib/calc'
import fxFallback from './data/fx.fallback.json'
import VehicleForm from './components/VehicleForm.vue'
import ResultView from './components/ResultView.vue'
import Chips from './components/Chips.vue'
import Help from './components/Help.vue'

const blankVehicle = (): Vehicle => ({ make: '', model: '', year: new Date().getFullYear() - 5, fuel: 'petrol', marketSpec: 'US', brandTier: 'mass', decodeNotes: [] })
const blankRoute = (): RouteInput => ({
  origin: 'US', destination: 'UA', purchasePrice: 0, purchaseCurrency: 'USD', boughtFrom: 'auction', hasOriginProof: true,
  residenceTransfer: false, salvage: false, repairBudget: 0, delivery: 'auto', usInland: 'near',
})
const vehicle = ref<Vehicle>(blankVehicle())
const route = ref<RouteInput>(blankRoute())
const fx = reactive<FxRates>({ ...fxFallback, source: 'fallback' })

const origins: { value: Origin; label: string }[] = [
  { value: 'US', label: 'США' }, { value: 'EU', label: 'Євросоюз' }, { value: 'UA', label: 'Україна' },
  { value: 'JP', label: 'Японія' }, { value: 'KR', label: 'Корея' }, { value: 'OTHER', label: 'Інше (ОАЕ, Грузія…)' },
]
const destinations: { value: Destination; label: string }[] = [{ value: 'UA', label: 'Україна' }, { value: 'ES', label: 'Іспанія' }]
const currencies: Currency[] = ['USD', 'EUR', 'UAH']

watch(() => route.value.destination, (d) => {
  if (d === 'UA' && route.value.origin === 'UA') route.value.origin = 'US'
  if (d === 'ES' && route.value.purchaseCurrency === 'UAH') route.value.purchaseCurrency = 'EUR'
})
watch(() => route.value.origin, (o) => {
  route.value.purchaseCurrency = o === 'US' ? 'USD' : 'EUR'
  route.value.boughtFrom = o === 'US' ? 'auction' : 'private'
})

const vehicleReady = computed(() => !!vehicle.value.make && !!vehicle.value.model && (vehicle.value.fuel === 'electric' ? !!vehicle.value.batteryKwh : !!vehicle.value.engineCc))
const ready = computed(() => vehicleReady.value && route.value.purchasePrice > 0)
const result = computed(() => (ready.value ? calculate(vehicle.value, route.value, fx) : null))

const isUs = computed(() => route.value.origin === 'US')
const showOriginProof = computed(() => route.value.destination === 'UA' && route.value.origin === 'EU')
const showResidence = computed(() => route.value.destination === 'ES' && route.value.origin !== 'EU')
const showDelivery = computed(() => route.value.origin === 'EU' || route.value.origin === 'UA')
const specMismatch = computed(() => route.value.origin === 'US' && vehicle.value.marketSpec === 'EU')

// ---- стан у URL ----
const encode = () => btoa(unescape(encodeURIComponent(JSON.stringify({ v: vehicle.value, r: route.value }))))
function decode(hash: string) {
  try {
    const { v, r } = JSON.parse(decodeURIComponent(escape(atob(hash)))) as { v: Vehicle; r: RouteInput }
    if (v && r) { vehicle.value = { ...blankVehicle(), ...v }; route.value = { ...blankRoute(), ...r } }
  } catch { /* ignore */ }
}
watch(result, (r) => { if (r) history.replaceState(null, '', `#s=${encode()}`) })
onMounted(async () => {
  const m = location.hash.match(/^#s=(.+)$/)
  if (m) decode(m[1]!)
  Object.assign(fx, await loadFx())
})
</script>

<template>
  <div class="wrap">
    <header>
      <h1>На номери</h1>
      <p class="sub">скільки коштує поставити авто на облік</p>
    </header>

    <section>
      <div class="row">
        <div class="f"><label>Звідки</label>
          <select v-model="route.origin" class="in big"><option v-for="o in origins" :key="o.value" :value="o.value" :disabled="route.destination === 'UA' && o.value === 'UA'">{{ o.label }}</option></select></div>
        <div class="f"><label>Куди на облік</label>
          <select v-model="route.destination" class="in big"><option v-for="d in destinations" :key="d.value" :value="d.value">{{ d.label }}</option></select></div>
      </div>
    </section>

    <section>
      <VehicleForm v-model="vehicle" :destination="route.destination" :origin="route.origin" />
      <p v-if="specMismatch" class="err">Європейська версія, але купується в США? Перевірте ринок.</p>
    </section>

    <Transition name="fade">
      <section v-if="vehicleReady">
        <div class="row three">
          <div class="f"><label>Ціна покупки <Help :text="isUs ? 'Ціна лоту без зборів аукціону — їх додамо окремо.' : 'Сума за договором або інвойсом. Митниця порівнює з ринком.'" /></label>
            <div class="group">
              <input v-model.number="route.purchasePrice" type="number" class="in" min="0" step="100" placeholder="10000" />
              <select v-model="route.purchaseCurrency" class="in"><option v-for="c in currencies" :key="c" :value="c">{{ c }}</option></select>
            </div>
          </div>
          <div class="f"><label>У кого</label>
            <select v-model="route.boughtFrom" class="in"><option value="auction">Аукціон (Copart/IAAI)</option><option value="dealer">Дилер</option><option value="private">Приватна особа</option></select></div>
          <div v-if="isUs" class="f"><label>Штат <Help text="Відстань до порту відправки визначає внутрішню доставку по США." /></label>
            <Chips v-model="route.usInland" :options="[{ value: 'near', label: 'схід (NJ, GA, FL, TX)' }, { value: 'far', label: 'захід (CA, WA…)' }]" /></div>
          <div v-if="showDelivery" class="f"><label>Доставка</label>
            <Chips v-model="route.delivery" :options="[{ value: 'auto', label: 'автовоз' }, { value: 'self', label: 'своїм ходом' }]" /></div>
        </div>
        <div class="row" style="margin-top:14px">
          <label v-if="showOriginProof" class="check"><input v-model="route.hasOriginProof" type="checkbox" /><span>EUR.1 / декларація походження</span><Help text="Мито 0% лише для авто, зібраних у ЄС, з підтвердженням походження. Для інвойсів до 6 000 € достатньо декларації продавця на інвойсі. Без нього — 10%." :source="{ title: 'Митний тариф України (zakon.rada.gov.ua)', url: 'https://zakon.rada.gov.ua/laws/show/2697-20' }" /></label>
          <label v-if="showResidence" class="check"><input v-model="route.residenceTransfer" type="checkbox" /><span>Пільга при переїзді</span><Help text="Traslado de residencia: 0% мита, IVA і matriculación. Умови: авто у власності ≥ 6 міс до переїзду, ви жили поза ЄС ≥ 12 міс, ввезення протягом 12 міс, без продажу 12 міс. Не діє, якщо ви вже резидент Іспанії і купуєте зараз." :source="{ title: 'Reglamento (CE) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32009R1186' }" /></label>
          <label class="check"><input v-model="route.salvage" type="checkbox" /><span>Потрібен ремонт</span><Help text="Авто після ДТП / salvage title. Додамо ваш бюджет ремонту з реалістичним запасом (+40% у максимумі)." /></label>
          <div v-if="route.salvage" class="f"><label>Бюджет ремонту, {{ route.purchaseCurrency }}</label><input v-model.number="route.repairBudget" type="number" class="in" min="0" step="100" placeholder="2000" /></div>
        </div>
      </section>
    </Transition>

    <Transition name="fade">
      <section v-if="result"><ResultView :result="result" :vehicle="vehicle" :route="route" :fx="fx" /></section>
    </Transition>

    <p v-if="!result" class="foot">Ставки — з офіційних джерел (zakon.rada.gov.ua, customs.gov.ua, boe.es, agenciatributaria.gob.es, dgt.es). Курс НБУ {{ fx.date }}. Розрахунок у браузері, нічого не зберігається.</p>
  </div>
</template>
