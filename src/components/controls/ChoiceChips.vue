<script setup lang="ts" generic="T extends string">
defineProps<{ options: { value: T; label: string }[] }>()
const model = defineModel<T | null>({ required: true })
</script>

<template>
  <div class="chips" role="radiogroup">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="chip"
      :class="{ on: model === option.value }"
      :aria-checked="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
