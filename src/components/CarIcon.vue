<script setup lang="ts">
import { computed } from 'vue'
// Minimal side-view car: one contour line plus two wheels.
// With `border`, the car sits on a dashed border line it is crossing.
const props = withDefaults(defineProps<{ width?: number; border?: boolean; stroke?: number }>(), { width: 168, border: false, stroke: 2 })
const CAR = 'M8 38V31c0-2 1.4-3.6 3.4-4.2L34 22l20-9.6c1.6-.8 3.4-1.2 5.2-1.2H103c2 0 3.9.8 5.4 2.2L124 26l25 4.4c3.4.6 6 3.6 6 7V38Z'
/** keep the stroke the same optical weight at any rendered size */
const sw = computed(() => (props.stroke * 168) / props.width)
</script>

<template>
  <svg class="caricon" :width="width" :viewBox="border ? '0 0 168 96' : '0 0 168 48'" fill="none" aria-hidden="true">
    <g :transform="border ? 'translate(0 24)' : undefined">
      <path v-if="border" d="M84 -20V72" :stroke-width="sw" stroke-linecap="round" :stroke-dasharray="`${sw * 2.5} ${sw * 4}`" class="border-line" />
      <path :d="CAR" fill="var(--bg)" stroke="currentColor" :stroke-width="sw" stroke-linejoin="round" />
      <g fill="var(--bg)" stroke="currentColor" :stroke-width="sw">
        <circle cx="42" cy="38" r="7" />
        <circle cx="126" cy="38" r="7" />
      </g>
    </g>
  </svg>
</template>
