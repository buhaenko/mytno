<script setup lang="ts">
import { LOCALES, LOCALE_NAMES, type Locale } from '../i18n'
const model = defineModel<Locale>({ required: true })
defineProps<{ label: string }>()
</script>

<template>
  <span class="langsel">
    <svg class="globe" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2" />
      <ellipse cx="8" cy="8" rx="2.6" ry="6.25" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M1.9 6h12.2M1.9 10h12.2" stroke="currentColor" stroke-width="1.2" fill="none" />
    </svg>
    <span class="name">{{ LOCALE_NAMES[model] }}</span>
    <svg class="chev" viewBox="0 0 12 8" width="10" height="7" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
    <select :value="model" :aria-label="label" @change="model = ($event.target as HTMLSelectElement).value as Locale">
      <option v-for="l in LOCALES" :key="l" :value="l">{{ LOCALE_NAMES[l] }}</option>
    </select>
  </span>
</template>
