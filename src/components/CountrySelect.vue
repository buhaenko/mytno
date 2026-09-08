<script setup lang="ts" generic="T extends 'UA' | 'ES' | 'US' | 'EU' | 'JP' | 'KR' | 'OTHER'">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Flag from './Flag.vue'
const props = defineProps<{ options: { value: T; label: string; disabled?: boolean }[]; placeholder: string }>()
const model = defineModel<T | null>({ required: true })
const open = ref(false)
const root = ref<HTMLElement | null>(null)
function onDoc(e: MouseEvent) { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
function pick(v: T) { model.value = v; open.value = false }
const current = () => props.options.find((o) => o.value === model.value)
</script>

<template>
  <div ref="root" class="csel" :class="{ open }">
    <button type="button" class="csel-btn" :class="{ empty: !model }" @click="open = !open">
      <Flag v-if="model" :code="model" />
      <span>{{ current()?.label ?? placeholder }}</span>
      <svg class="chev" viewBox="0 0 12 8" width="12" height="8"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
    </button>
    <Transition name="drop">
      <ul v-if="open" class="csel-list" role="listbox">
        <li v-for="o in options" :key="o.value">
          <button type="button" role="option" :aria-selected="o.value === model" :disabled="o.disabled" :class="{ on: o.value === model }" @click="pick(o.value)"><Flag :code="o.value" />{{ o.label }}</button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
