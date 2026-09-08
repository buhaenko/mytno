<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Currency, Destination, FxRates, Origin, RouteInput, Vehicle } from './types'
import { loadFx } from './lib/fx'
import { calculate } from './lib/calc'
import fxFallback from './data/fx.fallback.json'
import VehicleForm from './components/VehicleForm.vue'
import ResultView from './components/ResultView.vue'
import Chips from './components/Chips.vue'

const blankVehicle = (): Vehicle => ({ make: '', model: '', year: new Date().getFullYear() - 5, fuel: 'petrol', marketSpec: 'US', brandTier: 'mass', decodeNotes: [] })
const blankRoute = (): RouteInput => ({
  origin: 'US', destination: 'UA', purchasePrice: 0, purchaseCurrency: 'USD', boughtFrom: 'auction', hasOriginProof: true,
  residenceTransfer: false, salvage: false, repairBudget: 0, delivery: 'auto', usInland: 'near',
})
const vehicle = ref<Vehicle>(blankVehicle())
const route = ref<RouteInput>(blankRoute())
const fx = reactive<FxRates>({ ...fxFallback, source: 'fallback' })

const origins: { value: Origin; label: string }[] = [
  { value: 'US', label: '🇺🇸 США' }, { value: 'EU', label: '🇪🇺 Євросоюз' }, { value: 'UA', label: '🇺🇦 Україна' },
  { value: 'JP', label: '🇯🇵 Японія' }, { value: 'KR', label: '🇰🇷 Корея' }, { value: 'OTHER', label: '🌍 Інше (ОАЕ, Грузія…)' },
]
const destinations: { value: Destination; label: string }[] = [{ value: 'UA', label: '🇺🇦 Україна' }, { value: 'ES', label: '🇪🇸 Іспанія' }]
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
      <p class="sub">Реалістична ціна авто «на номерах»: податки, доставка, омологація, нюанси.</p>
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
      <p v-if="specMismatch" class="note warn">Авто позначене як європейська версія, але купується в США. Перевірте ринок — від цього залежить омологація.</p>
    </section>

    <Transition name="fade">
      <section v-if="vehicleReady">
        <div class="row three">
          <div class="f"><label>Ціна покупки</label>
            <div class="group">
              <input v-model.number="route.purchasePrice" type="number" class="in" min="0" step="100" placeholder="10000" />
              <select v-model="route.purchaseCurrency" class="in"><option v-for="c in currencies" :key="c" :value="c">{{ c }}</option></select>
            </div>
            <span class="hint">{{ isUs ? 'ціна лоту без зборів аукціону' : 'за договором / інвойсом' }}</span>
          </div>
          <div class="f"><label>У кого</label>
            <select v-model="route.boughtFrom" class="in"><option value="auction">Аукціон (Copart/IAAI)</option><option value="dealer">Дилер</option><option value="private">Приватна особа</option></select></div>
          <div v-if="isUs" class="f"><label>Штат</label>
            <Chips v-model="route.usInland" :options="[{ value: 'near', label: 'схід (NJ, GA, FL, TX)' }, { value: 'far', label: 'захід (CA, WA…)' }]" /></div>
          <div v-if="showDelivery" class="f"><label>Доставка</label>
            <Chips v-model="route.delivery" :options="[{ value: 'auto', label: 'автовоз' }, { value: 'self', label: 'своїм ходом' }]" /></div>
        </div>
        <div class="row" style="margin-top:14px">
          <label v-if="showOriginProof" class="check"><input v-model="route.hasOriginProof" type="checkbox" /><span>Є EUR.1 / декларація походження<div class="d">мито 0% для зібраних у ЄС; без підтвердження 10%</div></span></label>
          <label v-if="showResidence" class="check"><input v-model="route.residenceTransfer" type="checkbox" /><span>Пільга при переїзді (traslado de residencia)<div class="d">0% мита, IVA і matriculación; авто у власності ≥ 6 міс до переїзду</div></span></label>
          <label class="check"><input v-model="route.salvage" type="checkbox" /><span>Після ДТП / salvage — потрібен ремонт<div class="d">додамо бюджет ремонту з реалістичним запасом</div></span></label>
          <div v-if="route.salvage" class="f"><label>Бюджет ремонту, {{ route.purchaseCurrency }}</label><input v-model.number="route.repairBudget" type="number" class="in" min="0" step="100" placeholder="2000" /></div>
        </div>
      </section>
    </Transition>

    <Transition name="fade">
      <section v-if="result"><ResultView :result="result" :vehicle="vehicle" :route="route" :fx="fx" /></section>
    </Transition>

    <p v-if="!result" class="foot">Безкоштовно. Ставки з чинного законодавства, ринкові витрати — типові ціни 2026. Дані VIN — NHTSA, курси — НБУ. Усе рахується у вашому браузері.</p>
  </div>
</template>
