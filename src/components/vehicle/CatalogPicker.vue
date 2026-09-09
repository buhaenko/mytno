<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { loadIndex, loadYear, versionLabel, type Index, type Version, type Year } from '../../lib/vehicle/catalog'
import { useI18n } from '../../i18n'

/** Year → make → model → engine, straight from the EPA catalogue. */
const emit = defineEmits<{ pick: [payload: { make: string; model: string; year: number; version: Version; label: string }] }>()
const { t } = useI18n()

const index = ref<Index | null>(null)
const data = ref<Year | null>(null)
const loading = ref(false)

const year = ref<number | null>(null)
const make = ref('')
const model = ref('')
const version = ref(-1)

const makes = computed(() => (year.value && index.value ? index.value.makesByYear[String(year.value)] ?? [] : []))
const models = computed(() => (data.value && make.value ? Object.keys(data.value[make.value] ?? {}) : []))
const versions = computed<Version[]>(() => (data.value && make.value && model.value ? data.value[make.value]?.[model.value] ?? [] : []))
const label = (v: Version) => versionLabel(v, t)

onMounted(async () => { index.value = await loadIndex() })

watch(year, async (value) => {
  make.value = ''; model.value = ''; version.value = -1; data.value = null
  if (!value) return
  loading.value = true
  try { data.value = await loadYear(value) } finally { loading.value = false }
})
watch(make, () => { model.value = ''; version.value = -1 })
watch(model, () => { version.value = versions.value.length === 1 ? 0 : -1 })
watch(version, (i) => {
  const picked = versions.value[i]
  if (picked && year.value) emit('pick', { make: make.value, model: model.value, year: year.value, version: picked, label: label(picked) })
})
</script>

<template>
  <div class="grid grid-4">
    <select v-model="year" class="input">
      <option :value="null" disabled>{{ t('car.year') }}</option>
      <option v-for="y in index?.years ?? []" :key="y" :value="y">{{ y }}</option>
    </select>
    <select v-model="make" class="input" :disabled="!year || loading">
      <option value="" disabled>{{ loading ? '…' : t('car.make') }}</option>
      <option v-for="m in makes" :key="m" :value="m">{{ m }}</option>
    </select>
    <select v-model="model" class="input" :disabled="!make">
      <option value="" disabled>{{ t('car.model') }}</option>
      <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
    </select>
    <select v-model="version" class="input" :disabled="!model">
      <option :value="-1" disabled>{{ t('car.version') }}</option>
      <option v-for="(v, i) in versions" :key="v[7]" :value="i">{{ label(v) }}</option>
    </select>
  </div>
</template>
