<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Source } from '../../types'

/** The “?” next to a label: an explanation, the formula behind it and the official sources. */
const props = defineProps<{ text?: string; notes?: string[]; formula?: string; source?: Source | Source[] }>()

/** One source or a handful — the caller should not have to care which. */
const sources = computed<Source[]>(() => (props.source ? (Array.isArray(props.source) ? props.source : [props.source]) : []))

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const closeOnOutsideClick = (e: MouseEvent) => { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }

onMounted(() => { document.addEventListener('click', closeOnOutsideClick); document.addEventListener('keydown', closeOnEscape) })
onBeforeUnmount(() => { document.removeEventListener('click', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) })
</script>

<template>
  <span ref="root" class="tip">
    <button type="button" class="tip-toggle" :class="{ open }" aria-label="?" @click.stop="open = !open">?</button>
    <span v-if="open" class="tip-body" role="dialog">
      <span v-if="text">{{ text }}</span>
      <span v-for="(n, i) in notes" :key="i">{{ n }}</span>
      <code v-if="formula">{{ formula }}</code>
      <a v-for="s in sources" :key="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }} ↗</a>
    </span>
  </span>
</template>
