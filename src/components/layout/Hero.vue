<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n'

/** The question, then the two answers it needs. It shrinks to a route bar once both are given. */
const props = defineProps<{ compact: boolean; title?: string; tagline?: string; flag?: string }>()
const { t } = useI18n()

/** The closing word carries the accent; punctuation stays plain. */
const headline = computed(() => {
  const words = (props.title ?? t('app.title')).trim().split(' ')
  const last = words.at(-1) ?? ''
  const [, word = last, punctuation = ''] = last.match(/^(.*?)([?!.:;»"']*)$/) ?? []
  return { lead: words.slice(0, -1).join(' '), word, punctuation }
})
</script>

<template>
  <div class="hero" :class="{ compact }">
    <div class="hero-text">
      <span v-if="flag" class="hero-flag" :class="`fi fi-${flag}`"></span>
      <h1>{{ headline.lead }} <span class="accent">{{ headline.word }}</span>{{ headline.punctuation }}</h1>
      <p>{{ tagline ?? t('app.tagline') }}</p>
    </div>
    <div class="route"><slot /></div>
  </div>
</template>
