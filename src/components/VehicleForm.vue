<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Destination, Fuel, MarketSpec, Origin, Vehicle } from '../types'
import { checkDigitValid, detectMarketSpec, isValidVinFormat, modelYearFromVin, normalizeVin, wmiInfo } from '../lib/vin'
import { decodeVin, mapFuel, titleCase } from '../lib/nhtsa'
import { MAKES, MODELS, matchReference, tierForMake } from '../lib/models'
import Chips from './Chips.vue'
import Help from './Help.vue'

const vehicle = defineModel<Vehicle>({ required: true })
const props = defineProps<{ destination: Destination; origin: Origin }>()

const vinRaw = ref(vehicle.value.vin ?? '')
const loading = ref(false)
const error = ref('')
const manual = ref(false)
const ready = computed(() => !!vehicle.value.make && !!vehicle.value.model)
const vin = computed(() => normalizeVin(vinRaw.value))

const fuelOptions: { value: Fuel; label: string }[] = [
  { value: 'petrol', label: 'Бензин' }, { value: 'diesel', label: 'Дизель' }, { value: 'hybrid', label: 'Гібрид' },
  { value: 'phev', label: 'Plug-in' }, { value: 'electric', label: 'Електро' }, { value: 'lpg', label: 'Газ' },
]
const marketOptions: { value: MarketSpec; label: string }[] = [
  { value: 'US', label: 'США' }, { value: 'EU', label: 'Європа' }, { value: 'JP', label: 'Японія' }, { value: 'KR', label: 'Корея' }, { value: 'OTHER', label: 'інше' },
]
const isElectrified = computed(() => vehicle.value.fuel === 'electric' || vehicle.value.fuel === 'phev')
const forSpain = computed(() => props.destination === 'ES')

watch(vin, (v) => { if (isValidVinFormat(v) && v !== vehicle.value.vin) decode() })

async function decode() {
  error.value = ''
  if (!isValidVinFormat(vin.value)) return
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
      if (ref.engine.cc && (!v.engineCc || (v.engineCc % 100 === 0 && Math.abs(v.engineCc - ref.engine.cc) / ref.engine.cc < 0.05))) v.engineCc = ref.engine.cc
      if (!v.batteryKwh && ref.engine.kwh) v.batteryKwh = ref.engine.kwh
      if (!v.powerHp) v.powerHp = ref.engine.hp
      notes.push(`Довідник: ${ref.entry.model} · ${ref.engine.label} → CO₂ ${ref.engine.co2 || '—'} г/км, ціна нового ≈ ${ref.engine.listEur.toLocaleString('uk-UA')} €.`)
    } else if (!d.displacementCc && fuel !== 'electric') {
      notes.push(`NHTSA знає лише марку, рік і завод (виробник з ${w.country}). Заповніть об'єм і паливо${forSpain.value ? ', CO₂ і ціну нового' : ''}.`)
    }
    if (!checkDigitValid(vin.value) && w.region === 'NA') notes.push('Контрольна цифра не сходиться — перевірте VIN.')
    if (!make) error.value = 'VIN не розпізнано. Оберіть модель зі списку.'
    vehicle.value = v
  } catch (e) {
    error.value = `База NHTSA недоступна (${(e as Error).message}). Спробуйте ще раз або оберіть модель.`
  } finally {
    loading.value = false
  }
}

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
    batteryKwh: eng.kwh, co2Wltp: eng.co2 || undefined, listPriceNewEur: eng.listEur, brandTier: entry.tier, plantCountry: undefined,
    marketSpec: props.origin === 'US' ? 'US' : props.origin === 'JP' ? 'JP' : props.origin === 'KR' ? 'KR' : 'EU',
    decodeNotes: ['Дані з довідника моделей. Ринок (США/Європа) вкажіть самі.'],
  }
})
function toggleManual() { manual.value = !manual.value; error.value = '' }
</script>

<template>
  <div>
    <div class="f">
      <label>{{ manual ? 'Модель' : 'VIN' }} <Help :text="manual ? 'Довідник популярних моделей з двигунами, CO₂ і цінами нових. Ринок (США/Європа) вкажіть самі.' : 'Розпізнаємо через базу NHTSA: марка, модель, двигун, завод, ринок. Для європейських VIN база знає менше — решту підтягуємо з довідника або вводите самі.'" :source="manual ? undefined : { title: 'NHTSA vPIC API', url: 'https://vpic.nhtsa.dot.gov/api/' }" /></label>
      <div v-if="!manual" class="vin-row">
        <input v-model="vinRaw" class="in mono big" placeholder="17 символів" maxlength="20" autocomplete="off" spellcheck="false" @keyup.enter="decode" />
        <span v-if="loading" class="spin dark"></span>
      </div>
      <div v-else class="row three">
        <select v-model="mMake" class="in"><option value="" disabled>Марка</option><option v-for="mk in MAKES" :key="mk" :value="mk">{{ mk }}</option></select>
        <select v-model="mModelIdx" class="in" :disabled="!mMake"><option :value="-1" disabled>Модель</option><option v-for="x in modelsForMake" :key="x.i" :value="x.i">{{ x.m.model }}</option></select>
        <select v-model="mEngineIdx" class="in" :disabled="mModelIdx < 0"><option :value="-1" disabled>Двигун</option><option v-for="(e, i) in enginesForModel" :key="i" :value="i">{{ e.label }}</option></select>
      </div>
      <p class="tiny"><button class="link" @click="toggleManual">{{ manual ? 'Ввести VIN' : 'Немає VIN — обрати модель' }}</button></p>
      <p v-if="error" class="err">{{ error }}</p>
    </div>

    <Transition name="rise">
      <div v-if="ready" class="carbox">
        <div class="car">
          <div class="name"><span>{{ vehicle.make }} {{ vehicle.model }}</span><Help v-if="vehicle.decodeNotes.length" :lines="vehicle.decodeNotes" /></div>
          <span v-if="vehicle.plantCountry" class="tag">{{ vehicle.plantCountry.toLowerCase() }}</span>
        </div>
        <div class="row four">
          <div class="f"><label>Рік</label><input v-model.number="vehicle.year" type="number" class="in" min="1980" :max="new Date().getFullYear() + 1" /></div>
          <div class="f"><label>Паливо</label><select v-model="vehicle.fuel" class="in"><option v-for="f in fuelOptions" :key="f.value" :value="f.value">{{ f.label }}</option></select></div>
          <div v-if="vehicle.fuel !== 'electric'" class="f"><label>см³ <Help :text="destination === 'UA' ? 'Акциз: ставка в € за літр × вік. 2.0 л = 1 984 см³, не 2 000.' : 'Довідково; на податки в Іспанії об\'єм не впливає.'" /></label><input v-model.number="vehicle.engineCc" type="number" class="in" placeholder="1984" /></div>
          <div v-if="isElectrified" class="f"><label>кВт·год <Help text="Україна: акциз 1 € за кВт·год ємності батареї." /></label><input v-model.number="vehicle.batteryKwh" type="number" class="in" placeholder="75" /></div>
          <template v-if="forSpain">
            <div class="f"><label>CO₂ WLTP <Help text="Ставка impuesto de matriculación: до 120 г/км — 0%, 120–160 — 4,75%, 160–200 — 9,75%, від 200 або без сертифікації — 14,75%. З COC або європейського техпаспорта; у US-авто зазвичай відсутній." :source="{ title: 'Ley 38/1992, art. 70 (boe.es)', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741' }" /></label><input v-model.number="vehicle.co2Wltp" type="number" class="in" placeholder="168" /></div>
            <div class="f"><label>Ціна нового, € <Help text="Hacienda рахує impuesto de matriculación від табличної ціни нового × коефіцієнт віку, а не від вашої ціни. Без неї беремо вашу ціну." :source="{ title: 'AEAT — Vehículos: valoración', url: 'https://sede.agenciatributaria.gob.es/Sede/vehiculos-embarcaciones.html' }" /></label><input v-model.number="vehicle.listPriceNewEur" type="number" class="in" placeholder="47150" /></div>
          </template>
          <div class="f span"><label>Ринок <Help text="Версія для США/Японії не має європейського COC: в ЄС потрібна індивідуальна омологація і переобладнання світла. Визначено за VIN: «ZZZ» на позиціях 4–6 — Європа; правильна контрольна цифра — Північна Америка." /></label><Chips v-model="vehicle.marketSpec" :options="marketOptions" /></div>
        </div>
      </div>
    </Transition>
  </div>
</template>
