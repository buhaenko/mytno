<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

/** Numbers glide to their new value instead of jumping. */
const props = defineProps<{ value: number; format: (value: number) => string }>()
const shown = ref(props.value)
let frame = 0

watch(() => props.value, (to, from) => {
  cancelAnimationFrame(frame)
  const start = performance.now()
  const duration = 420
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / duration)
    shown.value = from + (to - from) * (1 - (1 - progress) ** 3)
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template><span>{{ format(shown) }}</span></template>
