<script setup lang="ts">
import { computed } from 'vue'
import site from '@config/site.json'
import type { Locale } from '../../i18n'
import { appUrl } from '../../lib/url'
import WheelMark from '../icons/WheelMark.vue'
import LangSelect from '../controls/LangSelect.vue'

const locale = defineModel<Locale>({ required: true })
defineProps<{ label: string }>()

/** Clicking the mark starts over: the home page, in the language being read. */
const home = computed(() => appUrl(locale.value))
</script>

<template>
  <header class="topbar">
    <a class="brand" :href="home"><WheelMark :size="22" /><span class="brand-name">{{ site.brand }}</span></a>
    <LangSelect v-model="locale" :label="label" />
  </header>
</template>
