<script setup lang="ts">
// Car wheel: tyre, rim, five spokes, hub. Line art so it reads at any size.
withDefaults(defineProps<{ size?: number }>(), { size: 20 })
</script>

<template>
  <svg class="wheel" :width="size" :height="size" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="13.2" stroke="currentColor" stroke-width="2" />
    <circle cx="16" cy="16" r="7.6" stroke="currentColor" stroke-width="1.4" opacity=".65" />
    <g stroke="currentColor" stroke-width="1.4" opacity=".65">
      <path d="M16 8.4V4.6" /><path d="M23.2 13.7l3.6-1.2" /><path d="M20.4 22.3l2.2 3" />
      <path d="M11.6 22.3l-2.2 3" /><path d="M8.8 13.7l-3.6-1.2" />
    </g>
    <circle cx="16" cy="16" r="2.6" fill="currentColor" />
  </svg>
</template>
