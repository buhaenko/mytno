<script setup lang="ts">
import { ref } from 'vue'

/** One step: a quiet label between an accent dot and a rule, then a card with the work in it. */
defineProps<{ title: string; plain?: boolean }>()

const root = ref<HTMLElement | null>(null)
defineExpose({ root })
</script>

<template>
  <section ref="root" class="step">
    <p class="step-head"><span class="step-mark"></span><span>{{ title }}</span><span class="step-rule"></span></p>
    <div v-if="plain"><slot /></div>
    <div v-else class="card"><slot /></div>
  </section>
</template>
