<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps<{ value: number; format: (v: number) => string }>()
const shown = ref(props.value)
let raf = 0
watch(() => props.value, (to, from) => {
  cancelAnimationFrame(raf)
  const start = performance.now()
  const dur = 420
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / dur)
    const e = 1 - Math.pow(1 - k, 3)
    shown.value = from + (to - from) * e
    if (k < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template><span>{{ format(shown) }}</span></template>
