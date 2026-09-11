<script setup lang="ts">
import { computed } from 'vue'
import site from '@config/site.json'
import type { Locale } from '../../i18n'
import { appUrl } from '../../lib/url'
import WheelMark from '../icons/WheelMark.vue'
import LangSelect from '../controls/LangSelect.vue'
import { LEGAL_PATH, SOURCES_PATH } from '../../lib/pages'

const locale = defineModel<Locale>({ required: true })
defineProps<{ label: string; sourcesLabel: string; legalLabel: string }>()

/** Clicking the mark starts over: the home page, in the language being read. */
const home = computed(() => appUrl(locale.value))
const sources = computed(() => `${appUrl(locale.value)}${SOURCES_PATH}`)
const legal = computed(() => `${appUrl(locale.value)}${LEGAL_PATH}`)
</script>

<template>
  <header class="topbar">
    <a class="brand" :href="home"><WheelMark :size="22" /><span class="brand-name">{{ site.brand }}</span></a>
    <span class="topbar-right">
      <a class="topbar-link" :href="sources">{{ sourcesLabel }}</a>
      <a class="topbar-link" :href="legal">{{ legalLabel }}</a>
      <LangSelect v-model="locale" :label="label" />
    </span>
  </header>
</template>
