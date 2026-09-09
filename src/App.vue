<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { CalcResult, Currency, Destination, FxRates, Origin, RouteInput, Vehicle } from './types'
import { loadFx } from './lib/fx'
import { calculate } from './lib/calc'
import { appUrl, createShareUrl, readShared } from './lib/share'
import countries from './data/countries.json'
import { ORIGIN_COUNTRIES, ORIGIN_GROUP } from './data/origins'
import fxFallback from './data/fx.fallback.json'
import { LOCALES, LOCALE_NAMES, useI18n, type Locale } from './i18n'
import { tierForMake } from './lib/models'
import CarStep from './components/CarStep.vue'
import ResultView from './components/ResultView.vue'
import CountrySelect from './components/CountrySelect.vue'
import Help from './components/Help.vue'

const { t, locale, region, setLocale } = useI18n()
// Last word of the headline gets the gradient treatment
const title = computed(() => {
  const words = t('app.title').trim().split(' ')
  const last = words[words.length - 1] ?? ''
  const m = last.match(/^(.*?)([?!.:;»"']*)$/)
  return { head: words.slice(0, -1).join(' '), last: m?.[1] || last, tail: m?.[2] ?? '' }
})
const blankVehicle = (): Vehicle => ({ make: '', model: '', year: new Date().getFullYear() - 5, fuel: 'petrol', marketSpec: 'US', brandTier: 'mass', decodeNotes: [] })
const vehicle = ref<Vehicle>(blankVehicle())
const originCountry = ref<string | null>(null)
const origin = computed<Origin | null>(() => (originCountry.value ? ORIGIN_GROUP[originCountry.value] ?? 'OTHER' : null))
const destination = ref<Destination | null>(null)
const price = ref<number>(0)
const priceText = ref('')
// Accepts '20 000', '20,000', '20.000', '20000' — digits only, thousands separators ignored
function onPriceInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  priceText.value = raw
  const digits = raw.replace(/[^\d]/g, '')
  price.value = digits ? Number(digits) : 0
}
const currency = ref<Currency>('USD')
const hasOriginProof = ref(true)
const residenceTransfer = ref(false)
const fx = reactive<FxRates>({ ...fxFallback, source: 'fallback' })
const started = ref(false)
const resultEl = ref<HTMLElement | null>(null)
const shareUrl = ref('')
const shareBusy = ref(false)
const copied = ref(false)

const DESTS = Object.keys(countries.destinations) as Destination[]
const origins = computed(() => {
  const list = ORIGIN_COUNTRIES.map((o) => ({ value: o.code, flag: o.code.toLowerCase(), label: region(o.code) }))
  const first = list.filter((o) => ['US', 'DE', 'PL', 'LT', 'UA', 'JP', 'KR'].includes(o.value))
  const rest = list.filter((o) => !first.includes(o)).sort((a, b) => a.label.localeCompare(b.label, locale.value))
  return [...first, ...rest]
})
const destinations = computed(() => {
  const list = DESTS.map((d) => ({ value: d, flag: d.toLowerCase(), label: region(d), disabled: origin.value === 'UA' && d === 'UA' }))
  const first = list.filter((d) => d.value === 'UA' || d.value === 'ES' || d.value === 'PL' || d.value === 'DE')
  const rest = list.filter((d) => !first.includes(d)).sort((a, b) => a.label.localeCompare(b.label, locale.value))
  return [...first, ...rest]
})
const currencies: Currency[] = ['USD', 'EUR', 'UAH']

const routeChosen = computed(() => !!origin.value && !!destination.value)
watch(routeChosen, (v) => { if (v) setTimeout(() => (started.value = true), 250) })
watch(originCountry, (c) => {
  currency.value = c === 'US' || c === 'CA' ? 'USD' : c === 'UA' ? 'UAH' : 'EUR'
  if (origin.value === 'UA' && destination.value === 'UA') destination.value = null
})

const route = computed<RouteInput | null>(() => (origin.value && destination.value
  ? { origin: origin.value, destination: destination.value, purchasePrice: price.value, purchaseCurrency: currency.value, hasOriginProof: hasOriginProof.value, residenceTransfer: residenceTransfer.value }
  : null))
const vehicleReady = computed(() => !!vehicle.value.make && !!vehicle.value.model && (vehicle.value.fuel === 'electric' ? !!vehicle.value.batteryKwh : !!vehicle.value.engineCc))
const result = computed<CalcResult | null>(() => (route.value && vehicleReady.value && price.value > 0 ? calculate(vehicle.value, route.value, fx) : null))
const showOriginProof = computed(() => destination.value === 'UA' && origin.value === 'EU')
const showResidence = computed(() => destination.value !== 'UA' && origin.value !== 'EU')

const shareState = computed(() => ({ v: { ...vehicle.value, decodeNotes: [] }, r: route.value, l: locale.value, oc: originCountry.value }))
// ---- all state lives in the URL: query params before a result, the short share code once one exists ----
let restoring = true
const Q = { from: 'from', to: 'to', price: 'price', cur: 'cur', proof: 'proof', reloc: 'reloc' } as const
function stateQuery(): string {
  const q = new URLSearchParams()
  if (originCountry.value) q.set(Q.from, originCountry.value)
  if (destination.value) q.set(Q.to, destination.value)
  const v = vehicle.value
  if (v.vin) q.set('vin', v.vin)
  if (v.make) { q.set('make', v.make); q.set('model', v.model); q.set('year', String(v.year)); q.set('fuel', v.fuel); q.set('market', v.marketSpec) }
  if (v.engineCc) q.set('cc', String(v.engineCc))
  if (v.batteryKwh) q.set('kwh', String(v.batteryKwh))
  if (v.co2Wltp) q.set('co2', String(v.co2Wltp))
  if (v.listPriceNewEur) q.set('lp', String(v.listPriceNewEur))
  if (v.plantCountry) q.set('plant', v.plantCountry)
  if (v.powerHp) q.set('hp', String(v.powerHp))
  if (price.value) { q.set(Q.price, String(price.value)); q.set(Q.cur, currency.value) }
  if (!hasOriginProof.value) q.set(Q.proof, '0')
  if (residenceTransfer.value) q.set(Q.reloc, '1')
  const qs = q.toString()
  return qs ? `?${qs}` : ''
}
// The address bar always carries the readable query state; the short code stays in the share field only.
function syncUrl() {
  if (restoring) return
  const target = appUrl(locale.value, '', stateQuery()).slice(location.origin.length)
  if (location.pathname + location.search !== target) history.replaceState(null, '', target)
}
watch(shareState, syncUrl, { deep: true })
function applyQuery(q: URLSearchParams) {
  const from = q.get(Q.from), to = q.get(Q.to)
  if (from && ORIGIN_GROUP[from]) originCountry.value = from
  if (to && DESTS.includes(to as Destination)) destination.value = to as Destination
  const num = (k: string) => { const n = Number(q.get(k)); return Number.isFinite(n) && n > 0 ? n : undefined }
  const v = blankVehicle()
  v.vin = q.get('vin') ?? undefined
  v.make = q.get('make') ?? ''; v.model = q.get('model') ?? ''
  v.year = num('year') ?? v.year
  const fuel = q.get('fuel'); if (fuel) v.fuel = fuel as Vehicle['fuel']
  const market = q.get('market'); if (market) v.marketSpec = market as Vehicle['marketSpec']
  v.engineCc = num('cc'); v.batteryKwh = num('kwh'); v.co2Wltp = num('co2'); v.listPriceNewEur = num('lp'); v.powerHp = num('hp')
  v.plantCountry = q.get('plant') ?? undefined
  if (v.make) v.brandTier = tierForMake(v.make)
  if (v.vin || v.make) vehicle.value = v
  const p = num(Q.price); if (p) { price.value = p; priceText.value = String(p) }
  const cur = q.get(Q.cur); if (cur === 'USD' || cur === 'EUR' || cur === 'UAH') currency.value = cur
  if (q.get(Q.proof) === '0') hasOriginProof.value = false
  if (q.get(Q.reloc) === '1') residenceTransfer.value = true
  if (from && to) started.value = true
}

watch(result, async (r, prev) => {
  if (r && !prev) { await nextTick(); resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
})
// The share link is generated automatically (debounced) as soon as a result exists; clicking the field copies it.
let shareTimer = 0
let shareSeq = 0
function scheduleShare(delay = 500) {
  shareUrl.value = ''
  clearTimeout(shareTimer)
  if (!result.value || restoring) return
  const seq = ++shareSeq
  shareBusy.value = true
  shareTimer = window.setTimeout(async () => {
    const url = await createShareUrl(shareState.value, locale.value)
    if (seq === shareSeq) { shareUrl.value = url; shareBusy.value = false }
  }, delay)
}
watch([result, shareState], () => scheduleShare(), { deep: true })
async function copyShare() {
  if (!shareUrl.value) return
  try { await navigator.clipboard.writeText(shareUrl.value); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch { /* noop */ }
}
function applyShared(s: { v?: Vehicle; r?: RouteInput; l?: Locale; oc?: string | null }) {
  if (!s.v || !s.r) return
  vehicle.value = { ...blankVehicle(), ...s.v }
  originCountry.value = s.oc ?? (s.r.origin === 'EU' ? 'DE' : s.r.origin === 'OTHER' ? 'GB' : s.r.origin); destination.value = s.r.destination; price.value = s.r.purchasePrice; priceText.value = s.r.purchasePrice ? String(s.r.purchasePrice) : ''; currency.value = s.r.purchaseCurrency
  hasOriginProof.value = s.r.hasOriginProof; residenceTransfer.value = s.r.residenceTransfer
  started.value = true
}
async function changeLocale(l: Locale) {
  await setLocale(l)
  history.replaceState(null, '', `${appUrl(l, '', location.search).slice(location.origin.length)}${location.hash}`)
}
onMounted(async () => {
  type Shared = { v?: Vehicle; r?: RouteInput; l?: Locale; oc?: string | null }
  const shared = await readShared<Shared>()
  if (shared) { applyShared(shared); history.replaceState(null, '', appUrl(shared.l ?? locale.value, '', '').slice(location.origin.length)) }
  else applyQuery(new URLSearchParams(location.search))
  await nextTick()
  restoring = false
  scheduleShare(0)
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
      <div class="glow"></div>
      <div class="ring"></div>
      <div class="pill-row"><span class="pill"><span class="pd"></span>{{ t('app.badge') }}</span></div>
      <div class="hero-text">
        <h1>{{ title.head }} <span class="grad">{{ title.last }}</span>{{ title.tail }}</h1>
        <p>{{ t('app.tagline') }}</p>
      </div>
      <div class="route">
        <CountrySelect v-model="originCountry" :options="origins" :placeholder="t('app.from')" />
        <span class="arrow"><svg viewBox="0 0 24 12"><path d="M0 6h22M17 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" /></svg></span>
        <CountrySelect v-model="destination" :options="destinations" :placeholder="t('app.to')" />
      </div>
    </div>

    <Transition name="rise">
      <section v-if="started && routeChosen" class="s">
        <div class="step-head"><span class="num">01</span><span class="t">{{ t('step.car') }}</span><span class="line"></span></div>
        <div class="card"><CarStep v-model="vehicle" :destination="destination!" :origin="origin!" /></div>
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="started && routeChosen && vehicleReady" class="s">
        <div class="step-head"><span class="num">02</span><span class="t">{{ t('step.price') }}</span><span class="line"></span></div>
        <div class="card">
          <div class="row three">
            <div class="f"><label>{{ t('price.label') }} <Help :text="t('price.help')" /></label>
              <div class="group"><input :value="priceText" type="text" inputmode="numeric" autocomplete="off" class="in" placeholder="10000" @input="onPriceInput" /><select v-model="currency" class="in"><option v-for="c in currencies" :key="c" :value="c">{{ c }}</option></select></div>
            </div>
            <label v-if="showOriginProof" class="check"><input v-model="hasOriginProof" type="checkbox" /><span>{{ t('price.originProof') }}</span><Help :text="t('price.help.originProof')" :source="{ title: 'zakon.rada.gov.ua', url: 'https://zakon.rada.gov.ua/laws/show/2697-20' }" /></label>
            <label v-if="showResidence" class="check"><input v-model="residenceTransfer" type="checkbox" /><span>{{ t('price.residence') }}</span><Help :text="t('price.help.residence')" :source="{ title: 'Regulation (EC) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1186' }" /></label>
          </div>
        </div>
      </section>
    </Transition>

    <Transition name="rise">
      <section v-if="result && route" ref="resultEl" class="s result">
        <div class="step-head"><span class="num">03</span><span class="t">{{ t('step.result') }}</span><span class="line"></span></div>
        <ResultView :result="result" :vehicle="vehicle" :route="route" :fx="fx">
          <template #share>
            <label class="sharebox" :class="{ done: copied }" @click="copyShare">
              <span class="inner">
                <span class="k"><span class="pd" :class="{ pulse: !shareUrl }"></span>{{ copied ? t('result.copied') : t('result.share') }}</span>
                <input class="in mono-url" :value="shareUrl || '…'" readonly @focus="($event.target as HTMLInputElement).select()" />
              </span>
            </label>
          </template>
        </ResultView>
      </section>
    </Transition>

    <p v-if="!started" class="foot center">{{ t('app.foot', { date: fx.date }) }}</p>
  </div>
</template>
