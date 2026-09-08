<script setup lang="ts" generic="T extends string">
defineProps<{ options: { value: T; label: string; hint?: string }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="chips" role="radiogroup">
    <button v-for="o in options" :key="o.value" type="button" role="radio" :aria-checked="model === o.value" class="chip" :class="{ on: model === o.value }" :title="o.hint" @click="model = o.value">{{ o.label }}</button>
  </div>
</template>
