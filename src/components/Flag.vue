<script setup lang="ts">
defineProps<{ code: 'UA' | 'ES' | 'US' | 'EU' | 'JP' | 'KR' | 'OTHER' }>()
</script>

<template>
  <svg class="flag" viewBox="0 0 24 16" width="22" height="15" aria-hidden="true">
    <template v-if="code === 'UA'"><rect width="24" height="8" fill="#005BBB" /><rect y="8" width="24" height="8" fill="#FFD500" /></template>
    <template v-else-if="code === 'ES'"><rect width="24" height="16" fill="#AA151B" /><rect y="4" width="24" height="8" fill="#F1BF00" /></template>
    <template v-else-if="code === 'US'">
      <rect width="24" height="16" fill="#fff" />
      <g fill="#B22234"><rect y="0" width="24" height="1.25" /><rect y="2.5" width="24" height="1.25" /><rect y="5" width="24" height="1.25" /><rect y="7.5" width="24" height="1.25" /><rect y="10" width="24" height="1.25" /><rect y="12.5" width="24" height="1.25" /><rect y="15" width="24" height="1" /></g>
      <rect width="10" height="8.75" fill="#3C3B6E" />
    </template>
    <template v-else-if="code === 'EU'">
      <rect width="24" height="16" fill="#003399" />
      <g fill="#FFCC00"><circle cx="12" cy="3.5" r=".7" /><circle cx="14.25" cy="4.1" r=".7" /><circle cx="15.9" cy="5.75" r=".7" /><circle cx="16.5" cy="8" r=".7" /><circle cx="15.9" cy="10.25" r=".7" /><circle cx="14.25" cy="11.9" r=".7" /><circle cx="12" cy="12.5" r=".7" /><circle cx="9.75" cy="11.9" r=".7" /><circle cx="8.1" cy="10.25" r=".7" /><circle cx="7.5" cy="8" r=".7" /><circle cx="8.1" cy="5.75" r=".7" /><circle cx="9.75" cy="4.1" r=".7" /></g>
    </template>
    <template v-else-if="code === 'JP'"><rect width="24" height="16" fill="#fff" /><circle cx="12" cy="8" r="4.5" fill="#BC002D" /></template>
    <template v-else-if="code === 'KR'">
      <rect width="24" height="16" fill="#fff" />
      <path d="M12 3.6a4.4 4.4 0 0 1 0 8.8z" fill="#0047A0" /><path d="M12 3.6a4.4 4.4 0 0 0 0 8.8z" fill="#CD2E3A" />
      <circle cx="12" cy="5.8" r="2.2" fill="#CD2E3A" /><circle cx="12" cy="10.2" r="2.2" fill="#0047A0" />
    </template>
    <template v-else>
      <rect width="24" height="16" fill="#fff" />
      <circle cx="12" cy="8" r="5.5" fill="none" stroke="#555" stroke-width="1" /><ellipse cx="12" cy="8" rx="2.4" ry="5.5" fill="none" stroke="#555" stroke-width="1" /><line x1="6.5" y1="8" x2="17.5" y2="8" stroke="#555" stroke-width="1" />
    </template>
    <rect width="24" height="16" fill="none" stroke="rgba(0,0,0,.15)" />
  </svg>
</template>
