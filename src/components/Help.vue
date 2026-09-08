<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
defineProps<{ text?: string; formula?: string; source?: { title: string; url: string }; lines?: string[] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
function onDoc(e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey) })
</script>

<template>
  <span ref="root" class="help">
    <button type="button" class="q" :class="{ on: open }" aria-label="Help" @click.stop="open = !open">?</button>
    <span v-if="open" class="pop" role="dialog">
      <slot>
        <span v-if="text">{{ text }}</span>
        <template v-if="lines"><span v-for="(l, i) in lines" :key="i" class="pl">{{ l }}</span></template>
        <code v-if="formula">{{ formula }}</code>
        <a v-if="source" :href="source.url" target="_blank" rel="noopener">{{ source.title }} ↗</a>
      </slot>
    </span>
  </span>
</template>
