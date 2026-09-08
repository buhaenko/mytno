<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Currency, Destination, FxRates, Origin, RouteInput, Vehicle } from './types'
import { loadFx } from './lib/fx'
import { calculate } from './lib/calc'
import fxFallback from './data/fx.fallback.json'
import VehicleForm from './components/VehicleForm.vue'
import ResultView from './components/ResultView.vue'
import Flag from './components/Flag.vue'
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

const origins: { value: Origin; label: string }[] = [
  { value: 'US', label: 'США' }, { value: 'EU', label: 'Євросоюз' }, { value: 'UA', label: 'Україна' },
  { value: 'JP', label: 'Японія' }, { value: 'KR', label: 'Корея' }, { value: 'OTHER', label: 'Інше' },
]
const destinations: { value: Destination; label: string }[] = [{ value: 'UA', label: 'Україна' }, { value: 'ES', label: 'Іспанія' }]
const currencies: Currency[] = ['USD', 'EUR', 'UAH']

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
const result = computed(() => (route.value && vehicleReady.value && price.value > 0 ? calculate(vehicle.value, route.value, fx) : null))

const showOriginProof = computed(() => destination.value === 'UA' && origin.value === 'EU')
const showResidence = computed(() => destination.value === 'ES' && origin.value !== 'EU')
const showFreight = computed(() => origin.value !== 'EU' || destination.value === 'UA')

const encode = () => btoa(unescape(encodeURIComponent(JSON.stringify({ v: vehicle.value, r: route.value }))))
function decode(hash: string) {
  try {
    const { v, r } = JSON.parse(decodeURIComponent(escape(atob(hash)))) as { v: Vehicle; r: RouteInput }
    if (!v || !r) return
    vehicle.value = { ...blankVehicle(), ...v }
    origin.value = r.origin; destination.value = r.destination; price.value = r.purchasePrice; currency.value = r.purchaseCurrency
    freight.value = r.freightToBorder ?? 0; hasOriginProof.value = r.hasOriginProof; residenceTransfer.value = r.residenceTransfer
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
    <header><h1>На номери</h1><p class="sub">скільки коштує розмитнити авто</p></header>

    <section class="s">
      <div class="f"><label>Звідки</label>
        <div class="flags">
          <button v-for="o in origins" :key="o.value" type="button" class="fchip" :class="{ on: origin === o.value }" @click="origin = o.value"><Flag :code="o.value" />{{ o.label }}</button>
        </div>
      </div>
    </section>

    <Transition name="rise">
      <section v-if="origin" class="s">
        <div class="f"><label>Куди на облік</label>
          <div class="flags">
            <button v-for="d in destinations" :key="d.value" type="button" class="fchip" :class="{ on: destination === d.value }" :disabled="origin === 'UA' && d.value === 'UA'" @click="destination = d.value"><Flag :code="d.value" />{{ d.label }}</button>
          </div>
        </div>
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="origin && destination" class="s">
        <VehicleForm v-model="vehicle" :destination="destination" :origin="origin" />
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="origin && destination && vehicleReady" class="s">
        <div class="row three">
          <div class="f"><label>Ціна авто <Help text="Сума за договором, інвойсом або аукціонним лотом. Митниця порівнює з ринком; верхня межа діапазону — переоцінка на 15%." /></label>
            <div class="group"><input v-model.number="price" type="number" class="in" min="0" step="100" placeholder="10000" /><select v-model="currency" class="in"><option v-for="c in currencies" :key="c" :value="c">{{ c }}</option></select></div>
          </div>
          <div v-if="showFreight" class="f"><label>Доставка до кордону <Help :text="destination === 'UA' ? 'Входить у митну вартість: фрахт і доставка до кордону України (для США зазвичай 1 500–2 500 $). Якщо не знаєте — залиште 0, податки будуть занижені.' : 'CIF: доставка і страховка до кордону ЄС входять у митну вартість.'" /></label>
            <input v-model.number="freight" type="number" class="in" min="0" step="100" placeholder="0" />
          </div>
          <label v-if="showOriginProof" class="check"><input v-model="hasOriginProof" type="checkbox" /><span>EUR.1 / походження</span><Help text="Мито 0% лише для авто, зібраних у ЄС, з підтвердженням походження (EUR.1 або декларація продавця на інвойсі до 6 000 €). Без нього — 10%." :source="{ title: 'Митний тариф України', url: 'https://zakon.rada.gov.ua/laws/show/2697-20' }" /></label>
          <label v-if="showResidence" class="check"><input v-model="residenceTransfer" type="checkbox" /><span>Пільга при переїзді</span><Help text="Traslado de residencia: 0% мита, IVA і matriculación. Авто у власності ≥ 6 міс до переїзду, ви жили поза ЄС ≥ 12 міс, ввезення протягом 12 міс. Не діє, якщо ви вже резидент Іспанії." :source="{ title: 'Reglamento (CE) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32009R1186' }" /></label>
        </div>
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="result" class="s"><ResultView :result="result" :vehicle="vehicle" :route="route!" :fx="fx" /></section>
    </Transition>

    <p v-if="!result" class="foot">Ставки з офіційних джерел: zakon.rada.gov.ua, customs.gov.ua, boe.es, agenciatributaria.gob.es, dgt.es. Курс НБУ {{ fx.date }}. Розрахунок у браузері.</p>
  </div>
</template>
