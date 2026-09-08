<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Destination, Fuel, MarketSpec, Origin, Vehicle } from '../types'
import { checkDigitValid, detectMarketSpec, isValidVinFormat, modelYearFromVin, normalizeVin, wmiInfo } from '../lib/vin'
import { decodeVin, mapFuel, titleCase } from '../lib/nhtsa'
import { matchReference, tierForMake } from '../lib/models'
import { loadIndex, loadYear, matchCatalogModel, versionFuel, type CatalogIndex, type CatalogVersion, type CatalogYear } from '../lib/catalog'
import { useI18n } from '../i18n'
import Help from './Help.vue'

const vehicle = defineModel<Vehicle>({ required: true })
const props = defineProps<{ destination: Destination; origin: Origin }>()
const { t, region } = useI18n()

const mode = ref<'vin' | 'catalog'>('vin')
const vinRaw = ref(vehicle.value.vin ?? '')
const loading = ref(false)
const error = ref('')
const ready = computed(() => !!vehicle.value.make && !!vehicle.value.model)
const vin = computed(() => normalizeVin(vinRaw.value))
const forSpain = computed(() => props.destination === 'ES')
const isElectrified = computed(() => vehicle.value.fuel === 'electric' || vehicle.value.fuel === 'phev')

const fuels: Fuel[] = ['petrol', 'diesel', 'hybrid', 'phev', 'electric', 'lpg']
const markets: MarketSpec[] = ['US', 'EU', 'JP', 'KR', 'OTHER']

/** Підпис версії з каталогу EPA локалізованою мовою. */
function versionLabel(v: CatalogVersion): string {
  const [cc, cyl, fuel, co2, trany, drive, ev] = v
  const parts: string[] = []
  if (fuel === 'electric') parts.push(t('car.version.electric'), ev || '')
  else {
    parts.push(`${(cc / 1000).toFixed(1)} L`, cyl ? t('car.version.cyl', { n: cyl }) : '')
    parts.push(fuel === 'petrol' || fuel === 'diesel' || fuel === 'hybrid' || fuel === 'phev' ? t(`car.version.${fuel}`) : fuel)
  }
  parts.push(trany.replace(/\s*\(.*\)/, ''), drive.replace('-Wheel Drive', 'WD').replace('Front', 'F').replace('Rear', 'R').replace('All', 'A').replace('4WD or ', '').replace('Part-time ', ''))
  if (co2) parts.push(`${co2} g/km`)
  return parts.filter(Boolean).join(' · ')
}

function applyReference(v: Vehicle, notes: string[]) {
  const ref = matchReference({ make: v.make, model: v.model, year: v.year, engineCc: v.engineCc, fuel: v.fuel, powerHp: v.powerHp })
  if (!ref) return
  v.co2Wltp = ref.engine.co2 || undefined
  v.listPriceNewEur = ref.engine.listEur
  if (ref.engine.cc && (!v.engineCc || (v.engineCc % 100 === 0 && Math.abs(v.engineCc - ref.engine.cc) / ref.engine.cc < 0.05))) v.engineCc = ref.engine.cc
  if (!v.batteryKwh && ref.engine.kwh) v.batteryKwh = ref.engine.kwh
  if (!v.powerHp) v.powerHp = ref.engine.hp
  notes.push(t('car.note.reference', { model: ref.entry.model, engine: ref.engine.label, co2: ref.engine.co2 || '—', list: ref.engine.listEur.toLocaleString() }))
}

watch(vin, (v) => { if (isValidVinFormat(v) && v !== vehicle.value.vin) decode() })

async function decode() {
  error.value = ''
  if (!isValidVinFormat(vin.value)) return
  loading.value = true
  try {
    const d = await decodeVin(vin.value)
    const notes: string[] = []
    const spec = detectMarketSpec(vin.value, d.clean)
    const w = wmiInfo(vin.value)
    notes.push(t(`car.note.${spec.reasonKey}`, { country: w.countryKey ? region(w.countryKey) : w.country }))
    const year = d.modelYear ?? modelYearFromVin(vin.value) ?? vehicle.value.year
    const make = d.make ? titleCase(d.make) : ''
    const fuel = mapFuel(d)
    const v: Vehicle = {
      ...vehicle.value, vin: vin.value, make, model: [d.model, d.series, d.trim].filter(Boolean).join(' '), year,
      engineCc: d.displacementCc ? Math.round(d.displacementCc) : undefined, fuel, powerHp: d.hp, batteryKwh: d.batteryKwh,
      plantCountry: d.plantCountry, body: d.body, drive: d.drive, marketSpec: spec.spec, brandTier: make ? tierForMake(make) : 'mass',
      co2Wltp: undefined, listPriceNewEur: undefined, decodeNotes: notes,
    }
    if (make && v.model) {
      try {
        const cy = await loadYear(year)
        const cm = matchCatalogModel(cy, make, v.model)
        if (cm) {
          const cand = cm.versions.filter((x) => versionFuel(x) === fuel)
          const pick = (cand.length ? cand : cm.versions).sort((a, b) => Math.abs(a[0] - (v.engineCc ?? a[0])) - Math.abs(b[0] - (v.engineCc ?? b[0])))[0]
          if (pick) {
            if (pick[0] && (!v.engineCc || Math.abs(pick[0] - v.engineCc) / pick[0] < 0.06)) v.engineCc = pick[0]
            notes.push(t('car.note.epa', { model: cm.model, version: versionLabel(pick) }) + (pick[3] ? ' ' + t('car.note.epaCo2') : ''))
          }
        }
      } catch { /* каталог недоступний */ }
    }
    applyReference(v, notes)
    if (!d.displacementCc && !v.engineCc && fuel !== 'electric') notes.push(t('car.note.nhtsaLimited', { country: w.countryKey ? region(w.countryKey) : w.country }))
    if (!checkDigitValid(vin.value) && w.region === 'NA') notes.push(t('car.note.checkDigit'))
    if (!make) error.value = t('car.err.notRecognized')
    vehicle.value = v
  } catch (e) {
    error.value = t('car.err.nhtsaDown', { error: (e as Error).message })
  } finally {
    loading.value = false
  }
}

const index = ref<CatalogIndex | null>(null)
const cYear = ref<number | null>(null)
const cMake = ref('')
const cModel = ref('')
const cVersion = ref(-1)
const cData = ref<CatalogYear | null>(null)
const cLoading = ref(false)
const makes = computed(() => (cYear.value && index.value ? index.value.makesByYear[String(cYear.value)] ?? [] : []))
const models = computed(() => (cData.value && cMake.value ? Object.keys(cData.value[cMake.value] ?? {}) : []))
const versions = computed<CatalogVersion[]>(() => (cData.value && cMake.value && cModel.value ? cData.value[cMake.value]?.[cModel.value] ?? [] : []))
async function openCatalog() { mode.value = 'catalog'; error.value = ''; if (!index.value) index.value = await loadIndex() }
watch(cYear, async (y) => {
  cMake.value = ''; cModel.value = ''; cVersion.value = -1; cData.value = null
  if (!y) return
  cLoading.value = true
  try { cData.value = await loadYear(y) } finally { cLoading.value = false }
})
watch(cMake, () => { cModel.value = ''; cVersion.value = -1 })
watch(cModel, () => { cVersion.value = versions.value.length === 1 ? 0 : -1 })
watch(cVersion, (i) => {
  const ver = versions.value[i]
  if (!ver || !cYear.value) return
  const v: Vehicle = {
    ...vehicle.value, vin: undefined, make: cMake.value, model: cModel.value, year: cYear.value, engineCc: ver[0] || undefined, fuel: versionFuel(ver),
    powerHp: undefined, batteryKwh: undefined, co2Wltp: undefined, listPriceNewEur: undefined, plantCountry: undefined, drive: ver[5],
    brandTier: tierForMake(cMake.value), marketSpec: props.origin === 'US' ? 'US' : props.origin === 'JP' ? 'JP' : props.origin === 'KR' ? 'KR' : 'EU',
    decodeNotes: [t('car.note.catalogPick', { version: versionLabel(ver) }) + (ver[3] ? ' ' + t('car.note.epaCo2') : '')],
  }
  applyReference(v, v.decodeNotes)
  vehicle.value = v
})
</script>

<template>
  <div>
    <div class="f">
      <div class="modes">
        <div class="seg">
          <button type="button" class="mode" :class="{ on: mode === 'vin' }" @click="mode = 'vin'">{{ t('car.byVin') }}</button>
          <button type="button" class="mode" :class="{ on: mode === 'catalog' }" @click="openCatalog">{{ t('car.catalog') }}</button>
        </div>
        <Help :text="t(mode === 'vin' ? 'car.help.vin' : 'car.help.catalog')" :source="mode === 'vin' ? { title: 'NHTSA vPIC API', url: 'https://vpic.nhtsa.dot.gov/api/' } : { title: 'EPA fueleconomy.gov — Vehicle data', url: 'https://www.fueleconomy.gov/feg/download.shtml' }" />
      </div>
      <div v-if="mode === 'vin'" class="vin-row">
        <input v-model="vinRaw" class="in mono big" :placeholder="t('car.vinPlaceholder')" maxlength="20" autocomplete="off" spellcheck="false" @keyup.enter="decode" />
        <span v-if="loading" class="spin dark"></span>
      </div>
      <div v-else class="row four">
        <select v-model="cYear" class="in"><option :value="null" disabled>{{ t('car.year') }}</option><option v-for="y in index?.years ?? []" :key="y" :value="y">{{ y }}</option></select>
        <select v-model="cMake" class="in" :disabled="!cYear || cLoading"><option value="" disabled>{{ cLoading ? '…' : t('car.make') }}</option><option v-for="m in makes" :key="m" :value="m">{{ m }}</option></select>
        <select v-model="cModel" class="in" :disabled="!cMake"><option value="" disabled>{{ t('car.model') }}</option><option v-for="m in models" :key="m" :value="m">{{ m }}</option></select>
        <select v-model="cVersion" class="in" :disabled="!cModel"><option :value="-1" disabled>{{ t('car.version') }}</option><option v-for="(v, i) in versions" :key="v[7]" :value="i">{{ versionLabel(v) }}</option></select>
      </div>
      <p v-if="error" class="err">{{ error }}</p>
    </div>

    <Transition name="rise">
      <div v-if="ready" class="carbox">
        <div class="car">
          <div class="name"><span>{{ vehicle.make }} {{ vehicle.model }}</span><Help v-if="vehicle.decodeNotes.length" :lines="vehicle.decodeNotes" /></div>
          <span v-if="vehicle.plantCountry" class="tag">{{ vehicle.plantCountry.toLowerCase() }}</span>
        </div>
        <div class="row four">
          <div class="f"><label>{{ t('car.year') }}</label><input v-model.number="vehicle.year" type="number" class="in" min="1980" :max="new Date().getFullYear() + 1" /></div>
          <div class="f"><label>{{ t('car.fuel') }}</label><select v-model="vehicle.fuel" class="in"><option v-for="f in fuels" :key="f" :value="f">{{ t(`car.fuel.${f}`) }}</option></select></div>
          <div v-if="vehicle.fuel !== 'electric'" class="f"><label>{{ t('car.cc') }} <Help :text="t(destination === 'UA' ? 'car.help.ccUa' : destination === 'PL' ? 'car.help.ccPl' : 'car.help.ccOther')" /></label><input v-model.number="vehicle.engineCc" type="number" class="in" placeholder="1984" /></div>
          <div v-if="isElectrified" class="f"><label>{{ t('car.kwh') }} <Help :text="t('car.help.kwh')" /></label><input v-model.number="vehicle.batteryKwh" type="number" class="in" placeholder="75" /></div>
          <template v-if="forSpain">
            <div class="f"><label>{{ t('car.co2') }} <Help :text="t('car.help.co2')" :source="{ title: 'Ley 38/1992, art. 70 (boe.es)', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741' }" /></label><input v-model.number="vehicle.co2Wltp" type="number" class="in" placeholder="168" /></div>
            <div class="f"><label>{{ t('car.listPrice') }} <Help :text="t('car.help.listPrice')" :source="{ title: 'AEAT — Vehículos', url: 'https://sede.agenciatributaria.gob.es/Sede/vehiculos-embarcaciones.html' }" /></label><input v-model.number="vehicle.listPriceNewEur" type="number" class="in" placeholder="47150" /></div>
          </template>
          <div class="f span"><label>{{ t('car.market') }} <Help :text="t('car.help.market')" /></label>
            <div class="chips"><button v-for="m in markets" :key="m" type="button" class="chip" :class="{ on: vehicle.marketSpec === m }" @click="vehicle.marketSpec = m">{{ t(`car.market.${m}`) }}</button></div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
