<script setup lang="ts">
import site from '@config/site.json'
import type { Locale } from '../../i18n'
import WheelMark from '../icons/WheelMark.vue'
import LangSelect from '../controls/LangSelect.vue'

const locale = defineModel<Locale>({ required: true })
defineProps<{ label: string }>()
</script>

<template>
  <header class="topbar">
    <span class="brand"><WheelMark :size="22" /><span class="brand-name">{{ site.brand }}</span></span>
    <LangSelect v-model="locale" :label="label" />
  </header>
</template>
