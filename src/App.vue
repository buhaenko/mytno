<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { CalcResult, Currency, Destination, FxRates, Origin, RouteInput, Vehicle } from './types'
import { loadFx } from './lib/fx'
import { calculate } from './lib/calc'
import { createShareUrl, readShared } from './lib/share'
import countries from './data/countries.json'
import fxFallback from './data/fx.fallback.json'
import { LOCALES, LOCALE_NAMES, useI18n, type Locale } from './i18n'
import CarStep from './components/CarStep.vue'
import ResultView from './components/ResultView.vue'
import CountrySelect from './components/CountrySelect.vue'
import Help from './components/Help.vue'

const { t, locale, region, setLocale } = useI18n()
const blankVehicle = (): Vehicle => ({ make: '', model: '', year: new Date().getFullYear() - 5, fuel: 'petrol', marketSpec: 'US', brandTier: 'mass', decodeNotes: [] })
const vehicle = ref<Vehicle>(blankVehicle())
const origin = ref<Origin | null>(null)
const destination = ref<Destination | null>(null)
const price = ref<number>(0)
const currency = ref<Currency>('USD')
const hasOriginProof = ref(true)
const residenceTransfer = ref(false)
const fx = reactive<FxRates>({ ...fxFallback, source: 'fallback' })
const started = ref(false)
const resultEl = ref<HTMLElement | null>(null)
const shareUrl = ref('')
const shareBusy = ref(false)
const copied = ref(false)

const ORIGINS: { value: Origin; flag: string }[] = [{ value: 'US', flag: 'us' }, { value: 'EU', flag: 'eu' }, { value: 'UA', flag: 'ua' }, { value: 'JP', flag: 'jp' }, { value: 'KR', flag: 'kr' }, { value: 'OTHER', flag: 'xx' }]
const DESTS = Object.keys(countries.destinations) as Destination[]
const origins = computed(() => ORIGINS.map((o) => ({ value: o.value, flag: o.flag, label: o.value === 'OTHER' ? t('app.origin.OTHER') : region(o.value) })))
const destinations = computed(() => {
  const list = DESTS.map((d) => ({ value: d, flag: d.toLowerCase(), label: region(d), disabled: origin.value === 'UA' && d === 'UA' }))
  const first = list.filter((d) => d.value === 'UA' || d.value === 'ES' || d.value === 'PL' || d.value === 'DE')
  const rest = list.filter((d) => !first.includes(d)).sort((a, b) => a.label.localeCompare(b.label, locale.value))
  return [...first, ...rest]
})
const currencies: Currency[] = ['USD', 'EUR', 'UAH']

const routeChosen = computed(() => !!origin.value && !!destination.value)
watch(routeChosen, (v) => { if (v) setTimeout(() => (started.value = true), 250) })
watch(origin, (o) => {
  currency.value = o === 'US' ? 'USD' : 'EUR'
  if (o === 'UA' && destination.value === 'UA') destination.value = null
})

const route = computed<RouteInput | null>(() => (origin.value && destination.value
  ? { origin: origin.value, destination: destination.value, purchasePrice: price.value, purchaseCurrency: currency.value, hasOriginProof: hasOriginProof.value, residenceTransfer: residenceTransfer.value }
  : null))
const vehicleReady = computed(() => !!vehicle.value.make && !!vehicle.value.model && (vehicle.value.fuel === 'electric' ? !!vehicle.value.batteryKwh : !!vehicle.value.engineCc))
const result = computed<CalcResult | null>(() => (route.value && vehicleReady.value && price.value > 0 ? calculate(vehicle.value, route.value, fx) : null))
const showOriginProof = computed(() => destination.value === 'UA' && origin.value === 'EU')
const showResidence = computed(() => destination.value !== 'UA' && origin.value !== 'EU')

const shareState = computed(() => ({ v: { ...vehicle.value, decodeNotes: [] }, r: route.value, l: locale.value }))
watch(result, async (r, prev) => {
  shareUrl.value = ''
  if (r && !prev) { await nextTick(); resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
})
async function share() {
  if (shareBusy.value) return
  shareBusy.value = true
  try {
    shareUrl.value = await createShareUrl(shareState.value)
    history.replaceState(null, '', shareUrl.value.slice(shareUrl.value.indexOf('#')))
    try { await navigator.clipboard.writeText(shareUrl.value); copied.value = true; setTimeout(() => (copied.value = false), 2000) } catch { /* noop */ }
  } finally { shareBusy.value = false }
}
function applyShared(s: { v?: Vehicle; r?: RouteInput; l?: Locale }) {
  if (!s.v || !s.r) return
  vehicle.value = { ...blankVehicle(), ...s.v }
  origin.value = s.r.origin; destination.value = s.r.destination; price.value = s.r.purchasePrice; currency.value = s.r.purchaseCurrency
  hasOriginProof.value = s.r.hasOriginProof; residenceTransfer.value = s.r.residenceTransfer
  started.value = true
}
async function changeLocale(l: Locale) {
  await setLocale(l)
  const base = import.meta.env.BASE_URL
  history.replaceState(null, '', `${base}${l === 'en' ? '' : l + '/'}${location.hash}`)
}
onMounted(async () => {
  const shared = await readShared<{ v?: Vehicle; r?: RouteInput; l?: Locale }>()
  if (shared) applyShared(shared)
  Object.assign(fx, await loadFx())
})
</script>

<template>
  <div class="wrap">
    <div class="topline">
      <label class="lang"><span class="sr">{{ t('app.lang') }}</span>
        <select :value="locale" @change="changeLocale(($event.target as HTMLSelectElement).value as Locale)"><option v-for="l in LOCALES" :key="l" :value="l">{{ LOCALE_NAMES[l] }}</option></select>
      </label>
    </div>
    <div class="hero" :class="{ compact: started }">
      <div class="hero-text">
        <h1>{{ t('app.title') }}</h1>
        <p>{{ t('app.tagline') }}</p>
      </div>
      <div class="route">
        <CountrySelect v-model="origin" :options="origins" :placeholder="t('app.from')" />
        <svg class="arrow" viewBox="0 0 24 12" width="24" height="12"><path d="M0 6h22M17 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
        <CountrySelect v-model="destination" :options="destinations" :placeholder="t('app.to')" />
      </div>
    </div>

    <Transition name="rise">
      <section v-if="started && routeChosen" class="s"><CarStep v-model="vehicle" :destination="destination!" :origin="origin!" /></section>
    </Transition>

    <Transition name="rise">
      <section v-if="started && routeChosen && vehicleReady" class="s">
        <div class="row three">
          <div class="f"><label>{{ t('price.label') }} <Help :text="t('price.help')" /></label>
            <div class="group"><input v-model.number="price" type="number" class="in" min="0" step="100" placeholder="10000" /><select v-model="currency" class="in"><option v-for="c in currencies" :key="c" :value="c">{{ c }}</option></select></div>
          </div>
          <label v-if="showOriginProof" class="check"><input v-model="hasOriginProof" type="checkbox" /><span>{{ t('price.originProof') }}</span><Help :text="t('price.help.originProof')" :source="{ title: 'zakon.rada.gov.ua', url: 'https://zakon.rada.gov.ua/laws/show/2697-20' }" /></label>
          <label v-if="showResidence" class="check"><input v-model="residenceTransfer" type="checkbox" /><span>{{ t('price.residence') }}</span><Help :text="t('price.help.residence')" :source="{ title: 'Regulation (EC) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1186' }" /></label>
        </div>
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="result && route" ref="resultEl" class="s result">
        <ResultView :result="result" :vehicle="vehicle" :route="route" :fx="fx" @share="share">
          <template #share>
            <button type="button" class="btn" :disabled="shareBusy" @click="share">{{ copied ? t('result.copied') : t('result.share') }}</button>
            <Transition name="rise"><input v-if="shareUrl" class="in mono-url" :value="shareUrl" readonly @focus="($event.target as HTMLInputElement).select()" /></Transition>
          </template>
        </ResultView>
      </section>
    </Transition>

    <p v-if="!result" class="foot center">{{ t('app.foot', { date: fx.date }) }}</p>
  </div>
</template>
