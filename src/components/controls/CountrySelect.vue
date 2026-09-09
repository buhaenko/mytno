<script setup lang="ts" generic="T extends string">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/** `note` is the quiet tag on the right: which customs group the country belongs to. */
interface Country { value: T; label: string; flag: string; note?: string; disabled?: boolean }

const props = defineProps<{ options: Country[]; placeholder: string }>()
const model = defineModel<T | null>({ required: true })

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const selected = computed(() => props.options.find((o) => o.value === model.value))
const flagClass = (country?: Country) => `fi fi-${country?.flag ?? 'xx'}`

const closeOnOutsideClick = (e: MouseEvent) => { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('click', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutsideClick))

function choose(value: T) {
  model.value = value
  open.value = false
}
</script>

<template>
  <div ref="root" class="picker" :class="{ open }">
    <button type="button" class="picker-button" :class="{ empty: !model }" @click="open = !open">
      <span v-if="selected" :class="flagClass(selected)"></span>
      <span class="picker-label">{{ selected?.label ?? placeholder }}</span>
      <span v-if="selected?.note" class="picker-note">{{ selected.note }}</span>
      <svg class="picker-chevron" viewBox="0 0 12 8" width="12" height="8"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
    </button>
    <Transition name="drop">
      <ul v-if="open" class="picker-list" role="listbox">
        <li v-for="option in options" :key="option.value">
          <button
            type="button"
            role="option"
            :aria-selected="option.value === model"
            :disabled="option.disabled"
            :class="{ on: option.value === model }"
            @click="choose(option.value)"
          >
            <span :class="flagClass(option)"></span>
            <span class="picker-label">{{ option.label }}</span>
            <span v-if="option.note" class="picker-note">{{ option.note }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
