<script setup lang="ts">
import { ref } from 'vue'

/** A numbered step: a quiet label, a rule, and a card with the work in it. */
defineProps<{ number: string; title: string; plain?: boolean }>()

const root = ref<HTMLElement | null>(null)
defineExpose({ root })
</script>

<template>
  <section ref="root" class="step">
    <p class="step-head"><span class="step-number">{{ number }}</span><span>{{ title }}</span><span class="step-rule"></span></p>
    <div v-if="plain"><slot /></div>
    <div v-else class="card"><slot /></div>
  </section>
</template>
