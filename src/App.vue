<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { CalcResult, Currency, Destination, FxRates, Origin, RouteInput, Vehicle } from './types'
import { loadFx } from './lib/fx'
import { calculate } from './lib/calc'
import fxFallback from './data/fx.fallback.json'
import CarStep from './components/CarStep.vue'
import ResultView from './components/ResultView.vue'
import CountrySelect from './components/CountrySelect.vue'
import Help from './components/Help.vue'

const blankVehicle = (): Vehicle => ({ make: '', model: '', year: new Date().getFullYear() - 5, fuel: 'petrol', marketSpec: 'US', brandTier: 'mass', decodeNotes: [] })
const vehicle = ref<Vehicle>(blankVehicle())
const origin = ref<Origin | null>(null)
const destination = ref<Destination | null>(null)
const price = ref<number>(0)
const currency = ref<Currency>('USD')
const freight = ref<number>(0)
const hasOriginProof = ref(true)
const residenceTransfer = ref(false)
const fx = reactive<FxRates>({ ...fxFallback, source: 'fallback' })
const result = ref<CalcResult | null>(null)
const resultKey = ref('')
const resultEl = ref<HTMLElement | null>(null)

const origins: { value: Origin; label: string }[] = [
  { value: 'US', label: 'США' }, { value: 'EU', label: 'Євросоюз' }, { value: 'UA', label: 'Україна' },
  { value: 'JP', label: 'Японія' }, { value: 'KR', label: 'Корея' }, { value: 'OTHER', label: 'Інше' },
]
const destinations = computed<{ value: Destination; label: string; disabled?: boolean }[]>(() => [
  { value: 'UA', label: 'Україна', disabled: origin.value === 'UA' }, { value: 'ES', label: 'Іспанія' },
])
const currencies: Currency[] = ['USD', 'EUR', 'UAH']

const routeChosen = computed(() => !!origin.value && !!destination.value)
const started = ref(false) // hero піднявся
watch(routeChosen, (v) => { if (v) setTimeout(() => (started.value = true), 250) })
watch(origin, (o) => {
  currency.value = o === 'US' ? 'USD' : 'EUR'
  if (o === 'UA' && destination.value === 'UA') destination.value = null
})

const route = computed<RouteInput | null>(() =>
  origin.value && destination.value
    ? { origin: origin.value, destination: destination.value, purchasePrice: price.value, purchaseCurrency: currency.value, freightToBorder: freight.value, hasOriginProof: hasOriginProof.value, residenceTransfer: residenceTransfer.value }
    : null,
)
const vehicleReady = computed(() => !!vehicle.value.make && !!vehicle.value.model && (vehicle.value.fuel === 'electric' ? !!vehicle.value.batteryKwh : !!vehicle.value.engineCc))
const canCalc = computed(() => !!route.value && vehicleReady.value && price.value > 0)
const stateKey = computed(() => JSON.stringify({ v: { ...vehicle.value, decodeNotes: [] }, r: route.value }))
const dirty = computed(() => !!result.value && stateKey.value !== resultKey.value)

const showOriginProof = computed(() => destination.value === 'UA' && origin.value === 'EU')
const showResidence = computed(() => destination.value === 'ES' && origin.value !== 'EU')
const showFreight = computed(() => origin.value !== 'EU' || destination.value === 'UA')

const encode = () => btoa(unescape(encodeURIComponent(stateKey.value)))
const shareUrl = computed(() => `${location.origin}${location.pathname}#s=${encode()}`)

async function calc() {
  if (!route.value || !canCalc.value) return
  result.value = calculate(vehicle.value, route.value, fx)
  resultKey.value = stateKey.value
  history.replaceState(null, '', `#s=${encode()}`)
  await nextTick()
  resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function restore(hash: string) {
  try {
    const { v, r } = JSON.parse(decodeURIComponent(escape(atob(hash)))) as { v: Vehicle; r: RouteInput }
    if (!v || !r) return false
    vehicle.value = { ...blankVehicle(), ...v }
    origin.value = r.origin; destination.value = r.destination; price.value = r.purchasePrice; currency.value = r.purchaseCurrency
    freight.value = r.freightToBorder ?? 0; hasOriginProof.value = r.hasOriginProof; residenceTransfer.value = r.residenceTransfer
    return true
  } catch { return false }
}
onMounted(async () => {
  const m = location.hash.match(/^#s=(.+)$/)
  const restored = !!m && restore(m[1]!)
  Object.assign(fx, await loadFx())
  if (restored) { started.value = true; if (canCalc.value && route.value) { result.value = calculate(vehicle.value, route.value, fx); resultKey.value = stateKey.value } }
})
</script>

<template>
  <div class="wrap">
    <div class="hero" :class="{ compact: started }">
      <div class="hero-text">
        <h1>Скільки податків заплатиш за авто?</h1>
        <p>Розмитнення і постановка на облік за офіційними ставками. Спершу маршрут.</p>
      </div>
      <div class="route">
        <CountrySelect v-model="origin" :options="origins" placeholder="Звідки" />
        <svg class="arrow" viewBox="0 0 24 12" width="24" height="12"><path d="M0 6h22M17 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
        <CountrySelect v-model="destination" :options="destinations" placeholder="Куди на облік" />
      </div>
    </div>

    <Transition name="rise">
      <section v-if="started && routeChosen" class="s">
        <CarStep v-model="vehicle" :destination="destination!" :origin="origin!" />
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="started && routeChosen && vehicleReady" class="s">
        <div class="row three">
          <div class="f"><label>Ціна авто <Help text="Сума за договором, інвойсом або аукціонним лотом. Митниця порівнює з ринком; верхня межа діапазону — переоцінка на 15%." /></label>
            <div class="group"><input v-model.number="price" type="number" class="in" min="0" step="100" placeholder="10000" @keyup.enter="calc" /><select v-model="currency" class="in"><option v-for="c in currencies" :key="c" :value="c">{{ c }}</option></select></div>
          </div>
          <div v-if="showFreight" class="f"><label>Доставка до кордону <Help :text="destination === 'UA' ? 'Входить у митну вартість: фрахт і доставка до кордону України (для США зазвичай 1 500–2 500 $). Якщо не знаєте — залиште 0, податки будуть занижені.' : 'CIF: доставка і страховка до кордону ЄС входять у митну вартість.'" /></label>
            <input v-model.number="freight" type="number" class="in" min="0" step="100" placeholder="0" @keyup.enter="calc" />
          </div>
          <label v-if="showOriginProof" class="check"><input v-model="hasOriginProof" type="checkbox" /><span>EUR.1 / походження</span><Help text="Мито 0% лише для авто, зібраних у ЄС, з підтвердженням походження (EUR.1 або декларація продавця на інвойсі до 6 000 €). Без нього — 10%." :source="{ title: 'Митний тариф України', url: 'https://zakon.rada.gov.ua/laws/show/2697-20' }" /></label>
          <label v-if="showResidence" class="check"><input v-model="residenceTransfer" type="checkbox" /><span>Пільга при переїзді</span><Help text="Traslado de residencia: 0% мита, IVA і matriculación. Авто у власності ≥ 6 міс до переїзду, ви жили поза ЄС ≥ 12 міс, ввезення протягом 12 міс. Не діє, якщо ви вже резидент Іспанії." :source="{ title: 'Reglamento (CE) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32009R1186' }" /></label>
        </div>
        <Transition name="rise">
          <div v-if="!result || dirty" class="cta"><button type="button" class="btn big" :disabled="!canCalc" @click="calc">{{ result ? 'Перерахувати' : 'Порахувати' }}</button></div>
        </Transition>
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="result && route" ref="resultEl" class="s result" :class="{ stale: dirty }"><ResultView :result="result" :vehicle="vehicle" :route="route" :fx="fx" :share-url="shareUrl" /></section>
    </Transition>

    <p v-if="!started" class="foot center">Ставки з офіційних джерел: zakon.rada.gov.ua, customs.gov.ua, boe.es, agenciatributaria.gob.es, dgt.es. Курс НБУ {{ fx.date }}.</p>
  </div>
</template>
