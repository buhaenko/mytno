<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Destination, Origin, Vehicle } from '../../types'
import { identifyByCatalog, identifyByVin } from '../../lib/vehicle/identify'
import { useI18n } from '../../i18n'
import HelpTip from '../controls/HelpTip.vue'
import VinField from './VinField.vue'
import CatalogPicker from './CatalogPicker.vue'
import VehicleFields from './VehicleFields.vue'

/** Two ways to name a car: its VIN, or the catalogue. Both end in the same editable fields. */
const vehicle = defineModel<Vehicle>({ required: true })
const props = defineProps<{ destination: Destination; origin: Origin }>()
const { t } = useI18n()

const mode = ref<'vin' | 'catalog'>('catalog')
const busy = ref(false)
const error = ref('')

const identified = computed(() => !!vehicle.value.make && !!vehicle.value.model)
const notes = computed(() => vehicle.value.notes.map((n) => t(n.key, n.params)))
const marketOfOrigin = computed<Vehicle['market']>(() =>
  props.origin === 'US' || props.origin === 'JP' || props.origin === 'KR' ? props.origin : 'EU')

async function lookup(vin: string) {
  error.value = ''
  busy.value = true
  try {
    const found = await identifyByVin(vin, vehicle.value)
    vehicle.value = found.vehicle
    if (found.error) error.value = t(found.error)
  } catch (e) {
    error.value = t('car.err.nhtsaDown', { error: (e as Error).message })
  } finally {
    busy.value = false
  }
}

function pickFromCatalog(p: { make: string; model: string; year: number; version: Parameters<typeof identifyByCatalog>[3]; label: string }) {
  vehicle.value = identifyByCatalog(p.make, p.model, p.year, p.version, marketOfOrigin.value, p.label)
}
</script>

<template>
  <div>
    <div class="modes">
      <div class="segmented">
        <button type="button" class="segment" :class="{ on: mode === 'catalog' }" @click="mode = 'catalog'">{{ t('car.catalog') }}</button>
        <button type="button" class="segment" :class="{ on: mode === 'vin' }" @click="mode = 'vin'">{{ t('car.byVin') }}</button>
      </div>
      <HelpTip
        :text="t(mode === 'vin' ? 'car.help.vin' : 'car.help.catalog')"
        :source="mode === 'vin'
          ? { title: 'NHTSA vPIC API', url: 'https://vpic.nhtsa.dot.gov/api/' }
          : { title: 'EPA fueleconomy.gov', url: 'https://www.fueleconomy.gov/feg/download.shtml' }"
      />
    </div>

    <VinField v-if="mode === 'vin'" :vin="vehicle.vin" :busy="busy" :placeholder="t('car.vinPlaceholder')" @lookup="lookup" />
    <CatalogPicker v-else @pick="pickFromCatalog" />
    <p v-if="error" class="error">{{ error }}</p>

    <Transition name="rise">
      <div v-if="identified" class="found">
        <div class="found-head">
          <span class="found-name">{{ vehicle.make }} {{ vehicle.model }} <HelpTip v-if="notes.length" :notes="notes" /></span>
          <span v-if="vehicle.plantCountry" class="badge">{{ vehicle.plantCountry.toLowerCase() }}</span>
        </div>
        <VehicleFields v-model="vehicle" :destination="destination" />
      </div>
    </Transition>
  </div>
</template>
