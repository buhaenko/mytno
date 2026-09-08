<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Destination, Fuel, MarketSpec, Origin, Vehicle } from '../types'
import { checkDigitValid, detectMarketSpec, isValidVinFormat, modelYearFromVin, normalizeVin, wmiInfo } from '../lib/vin'
import { decodeVin, mapFuel, titleCase } from '../lib/nhtsa'
import { MAKES, MODELS, matchReference, tierForMake } from '../lib/models'
import Chips from './Chips.vue'

const vehicle = defineModel<Vehicle>({ required: true })
const props = defineProps<{ destination: Destination; origin: Origin }>()

const vinRaw = ref(vehicle.value.vin ?? '')
const loading = ref(false)
const error = ref('')
const manual = ref(false)
const more = ref(false)
const ready = computed(() => !!vehicle.value.make && !!vehicle.value.model)
const vin = computed(() => normalizeVin(vinRaw.value))
const vinOk = computed(() => isValidVinFormat(vin.value))

const fuelOptions: { value: Fuel; label: string }[] = [
  { value: 'petrol', label: 'Бензин' }, { value: 'diesel', label: 'Дизель' }, { value: 'hybrid', label: 'Гібрид' },
  { value: 'phev', label: 'Plug-in гібрид' }, { value: 'electric', label: 'Електро' }, { value: 'lpg', label: 'Газ/бензин' },
]
const marketOptions: { value: MarketSpec; label: string; hint: string }[] = [
  { value: 'US', label: 'для США', hint: 'Американська версія — без ЄС-омологації' },
  { value: 'EU', label: 'для Європи', hint: 'Європейська версія — є COC' },
  { value: 'JP', label: 'для Японії', hint: 'Праве кермо' },
  { value: 'KR', label: 'для Кореї', hint: '' },
  { value: 'OTHER', label: 'інше', hint: 'ОАЕ, Китай' },
]
const tierOptions = [
  { value: 'mass' as const, label: 'масовий' }, { value: 'premium' as const, label: 'преміум' }, { value: 'luxury' as const, label: 'люкс' },
]
const isElectrified = computed(() => vehicle.value.fuel === 'electric' || vehicle.value.fuel === 'phev')
const forSpain = computed(() => props.destination === 'ES')

// автодекод, коли введено 17 валідних символів
watch(vin, (v) => { if (isValidVinFormat(v) && v !== vehicle.value.vin) decode() })

async function decode() {
  error.value = ''
  if (!vinOk.value) return
  loading.value = true
  try {
    const d = await decodeVin(vin.value)
    const notes: string[] = []
    const spec = detectMarketSpec(vin.value, d.clean)
    notes.push(spec.reason)
    const w = wmiInfo(vin.value)
    const year = d.modelYear ?? modelYearFromVin(vin.value) ?? vehicle.value.year
    const make = d.make ? titleCase(d.make) : ''
    const fuel = mapFuel(d)
    const v: Vehicle = {
      ...vehicle.value, vin: vin.value, make, model: [d.model, d.series, d.trim].filter(Boolean).join(' '), year,
      engineCc: d.displacementCc ? Math.round(d.displacementCc) : undefined, fuel, powerHp: d.hp, batteryKwh: d.batteryKwh,
      plantCountry: d.plantCountry, body: d.body, drive: d.drive, marketSpec: spec.spec, brandTier: make ? tierForMake(make) : 'mass',
      co2Wltp: undefined, listPriceNewEur: undefined, decodeNotes: notes,
    }
    const ref = matchReference({ make: v.make, model: v.model, year: v.year, engineCc: v.engineCc, fuel: v.fuel, powerHp: v.powerHp })
    if (ref) {
      v.co2Wltp = ref.engine.co2 || undefined
      v.listPriceNewEur = ref.engine.listEur
      // NHTSA часто дає округлений об'єм (2.0 л → 2000); беремо точний з довідника, якщо він у межах 5%
      if (ref.engine.cc && (!v.engineCc || (v.engineCc % 100 === 0 && Math.abs(v.engineCc - ref.engine.cc) / ref.engine.cc < 0.05))) v.engineCc = ref.engine.cc
      if (!v.batteryKwh && ref.engine.kwh) v.batteryKwh = ref.engine.kwh
      if (!v.powerHp) v.powerHp = ref.engine.hp
      notes.push(`Довідник: ${ref.entry.model} · ${ref.engine.label} → CO₂ ${ref.engine.co2 || '—'} г/км, ціна нового ≈ ${ref.engine.listEur.toLocaleString('uk-UA')} €.`)
    } else if (!d.displacementCc && fuel !== 'electric') {
      notes.push(`База знає лише марку, рік і завод (виробник з ${w.country}). Заповніть об'єм, паливо${forSpain.value ? ', CO₂ і ціну нового' : ''}.`)
    }
    if (!make) notes.push('VIN не розпізнано. Введіть дані вручну.')
    if (!checkDigitValid(vin.value) && w.region === 'NA') notes.push('Контрольна цифра не сходиться — перевірте VIN.')
    if (!d.clean && d.errorText && make) notes.push(`NHTSA: ${d.errorText.split(';')[0]}`)
    vehicle.value = v
    manual.value = false
  } catch (e) {
    error.value = `База NHTSA недоступна (${(e as Error).message}). Спробуйте ще раз або введіть вручну.`
  } finally {
    loading.value = false
  }
}

// ---- вручну ----
const mMake = ref('')
const mModelIdx = ref(-1)
const mEngineIdx = ref(-1)
const modelsForMake = computed(() => MODELS.map((m, i) => ({ m, i })).filter((x) => x.m.make === mMake.value))
const enginesForModel = computed(() => (mModelIdx.value >= 0 ? MODELS[mModelIdx.value]!.engines : []))
watch(mMake, () => { mModelIdx.value = -1; mEngineIdx.value = -1 })
watch(mModelIdx, () => { mEngineIdx.value = -1 })
watch(mEngineIdx, (idx) => {
  const entry = MODELS[mModelIdx.value]
  const eng = entry?.engines[idx]
  if (!entry || !eng) return
  vehicle.value = {
    ...vehicle.value, vin: undefined, make: entry.make, model: entry.model, engineCc: eng.cc || undefined, fuel: eng.fuel, powerHp: eng.hp,
    batteryKwh: eng.kwh, co2Wltp: eng.co2 || undefined, listPriceNewEur: eng.listEur, brandTier: entry.tier, plantCountry: undefined, year: vehicle.value.year,
    marketSpec: props.origin === 'US' ? 'US' : props.origin === 'JP' ? 'JP' : props.origin === 'KR' ? 'KR' : 'EU',
    decodeNotes: ['Дані з довідника. Ринок (США/Європа) вкажіть самі — це вирішує омологацію.'],
  }
})
function blank() {
  vehicle.value = { ...vehicle.value, vin: undefined, make: vehicle.value.make || '', model: vehicle.value.model || '', decodeNotes: [] }
  manual.value = true
  mMake.value = ''
}
function openManual() { manual.value = true; vinRaw.value = '' }
</script>

<template>
  <div>
    <div v-if="!manual" class="f">
      <div style="display:flex; gap:8px">
        <input v-model="vinRaw" class="in mono big" placeholder="VIN · 17 символів" maxlength="20" autocomplete="off" spellcheck="false" @keyup.enter="decode" />
        <button v-if="!ready || loading" class="btn" :disabled="!vinOk || loading" @click="decode"><span v-if="loading" class="spin"></span>{{ loading ? '' : 'Знайти' }}</button>
      </div>
      <span class="hint">Підтягнемо марку, модель, двигун, завод і ринок. <button class="link" @click="openManual">Немає VIN — ввести вручну</button></span>
      <p v-if="error" class="note danger">{{ error }}</p>
    </div>

    <div v-else>
      <div class="row three">
        <div class="f"><label>Марка</label>
          <select v-model="mMake" class="in"><option value="" disabled>Оберіть</option><option v-for="mk in MAKES" :key="mk" :value="mk">{{ mk }}</option></select></div>
        <div class="f"><label>Модель</label>
          <select v-model="mModelIdx" class="in" :disabled="!mMake"><option :value="-1" disabled>Оберіть</option><option v-for="x in modelsForMake" :key="x.i" :value="x.i">{{ x.m.model }}</option></select></div>
        <div class="f"><label>Двигун</label>
          <select v-model="mEngineIdx" class="in" :disabled="mModelIdx < 0"><option :value="-1" disabled>Оберіть</option><option v-for="(e, i) in enginesForModel" :key="i" :value="i">{{ e.label }}</option></select></div>
      </div>
      <p class="hint small muted" style="margin-top:8px">Немає в списку? <button class="link" @click="blank">Заповнити поля самому</button> · <button class="link" @click="manual = false">Повернутися до VIN</button></p>
    </div>

    <Transition name="fade">
      <div v-if="ready || manual" style="margin-top:18px">
        <div v-if="ready" class="car">
          <div class="name">{{ vehicle.make }} {{ vehicle.model }} <span class="muted" style="font-weight:400">{{ vehicle.year }}</span></div>
          <div class="tags">
            <span class="tag accent">{{ marketOptions.find((m) => m.value === vehicle.marketSpec)?.label }}</span>
            <span v-if="vehicle.plantCountry" class="tag">завод: {{ vehicle.plantCountry.toLowerCase() }}</span>
            <span v-if="vehicle.drive" class="tag">{{ vehicle.drive.split('/')[0] }}</span>
          </div>
        </div>
        <p v-for="(n, i) in vehicle.decodeNotes" :key="i" class="note">{{ n }}</p>

        <div class="row three" style="margin-top:10px">
          <div class="f"><label>Марка</label><input v-model="vehicle.make" class="in" /></div>
          <div class="f"><label>Модель</label><input v-model="vehicle.model" class="in" /></div>
          <div class="f"><label>Рік</label><input v-model.number="vehicle.year" type="number" class="in" min="1980" :max="new Date().getFullYear() + 1" /></div>
          <div class="f"><label>Паливо</label><select v-model="vehicle.fuel" class="in"><option v-for="f in fuelOptions" :key="f.value" :value="f.value">{{ f.label }}</option></select></div>
          <div v-if="vehicle.fuel !== 'electric'" class="f"><label>Об'єм, см³</label><input v-model.number="vehicle.engineCc" type="number" class="in" placeholder="1984" /></div>
          <div v-if="isElectrified" class="f"><label>Батарея, кВт·год</label><input v-model.number="vehicle.batteryKwh" type="number" class="in" placeholder="75" /></div>
          <template v-if="forSpain">
            <div class="f"><label>CO₂ WLTP, г/км</label><input v-model.number="vehicle.co2Wltp" type="number" class="in" placeholder="168" /></div>
            <div class="f"><label>Ціна нового в Іспанії, €</label><input v-model.number="vehicle.listPriceNewEur" type="number" class="in" placeholder="47150" /></div>
          </template>
        </div>

        <div class="f" style="margin-top:14px"><label>Зроблене для ринку</label><Chips v-model="vehicle.marketSpec" :options="marketOptions" /></div>

        <p style="margin-top:12px"><button class="link" @click="more = !more">{{ more ? 'Сховати' : 'Більше параметрів' }}</button></p>
        <div v-if="more" class="row three" style="margin-top:10px">
          <div class="f"><label>Потужність, к.с.</label><input v-model.number="vehicle.powerHp" type="number" class="in" /></div>
          <div class="f"><label>Пробіг, км</label><input v-model.number="vehicle.mileageKm" type="number" class="in" /></div>
          <div class="f"><label>Країна заводу</label><input v-model="vehicle.plantCountry" class="in" placeholder="GERMANY" /><span class="hint">мито 0% в UA лише для зібраних у ЄС</span></div>
          <div class="f" style="grid-column: 1 / -1"><label>Клас бренду (ціни запчастин)</label><Chips v-model="vehicle.brandTier" :options="tierOptions" /></div>
        </div>
      </div>
    </Transition>
  </div>
</template>
