<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Source } from '../../types'

/** The “?” next to a label: an explanation, the formula behind it and the official sources. */
const props = defineProps<{ text?: string; notes?: string[]; formula?: string; source?: Source | Source[] }>()

/** One source or a handful — the caller should not have to care which. */
const sources = computed<Source[]>(() => (props.source ? (Array.isArray(props.source) ? props.source : [props.source]) : []))

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const mark = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)
const style = ref<Record<string, string>>({ visibility: 'hidden' })

/**
 * The panel hangs off the window, not off the page, and it is put in place by hand.
 *
 * It used to be absolutely positioned under its mark, which broke twice over on a phone.
 * The footer's mark sits near the right border, so the panel ran off the screen: half the
 * legal text was unreadable and the page grew a sideways scroll. And an absolutely
 * positioned panel still counts toward how far the document scrolls, so opening the last
 * tip on the page stretched the document — Chrome answered that by throwing the reader
 * back to the top, which is the one thing a tap on “?” must never do. Both are the same
 * fault: a panel that belongs to the page. This one does not.
 *
 * It follows the mark while the page scrolls, so it still reads as attached to it, and
 * it turns upwards or slides sideways rather than leave the screen.
 */
const place = () => {
  const panel = body.value
  const anchor = mark.value
  if (!panel || !anchor) return
  const edge = 10
  const gap = 6
  const m = anchor.getBoundingClientRect()
  const box = panel.getBoundingClientRect()
  const { clientWidth: width, clientHeight: height } = document.documentElement
  const left = Math.max(edge, Math.min(m.left, width - box.width - edge))
  let top = m.bottom + gap
  // No room below: open above the mark, and if there is no room there either, sit still.
  if (top + box.height > height - edge) top = m.top - gap - box.height
  if (top < edge) top = Math.max(edge, height - box.height - edge)
  style.value = { left: `${left}px`, top: `${top}px` }
}

const closeOnOutsideClick = (e: MouseEvent) => { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }
const follow = () => { if (open.value) place() }

watch(open, async (isOpen) => {
  style.value = { visibility: 'hidden' }
  if (!isOpen) return
  await nextTick()
  place()
})

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
  window.addEventListener('scroll', follow, { passive: true })
  window.addEventListener('resize', follow)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
  window.removeEventListener('scroll', follow)
  window.removeEventListener('resize', follow)
})
</script>

<template>
  <span ref="root" class="tip">
    <button ref="mark" type="button" class="tip-toggle" :class="{ open }" aria-label="?" @click.stop="open = !open">?</button>
    <span v-if="open" ref="body" class="tip-body" :style="style" role="dialog">
      <span v-if="text">{{ text }}</span>
      <span v-for="(n, i) in notes" :key="i">{{ n }}</span>
      <code v-if="formula">{{ formula }}</code>
      <a v-for="s in sources" :key="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }} ↗</a>
    </span>
  </span>
</template>
