<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { countryPath } from '../../lib/pages'
import { DESTINATION_INFO } from '../../lib/countrySources'

/** Every country has a page of its own; this is how a reader — and a crawler — finds it. */
const { t, locale, region } = useI18n()

const links = computed(() =>
  Object.keys(DESTINATION_INFO)
    .map((code) => ({ code, label: region(code), href: countryPath(import.meta.env.BASE_URL, locale.value, code) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value)))
</script>

<template>
  <nav class="countries">
    <span class="countries-label">{{ t('page.countries') }}</span>
    <a v-for="link in links" :key="link.code" :href="link.href">{{ link.label }}</a>
  </nav>
</template>
