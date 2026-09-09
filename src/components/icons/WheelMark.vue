<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * A five-spoke alloy wheel. Hovering spins it up; hovering again while it turns
 * adds momentum instead of restarting, and it always coasts to a smooth stop.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 22 })

const CENTRE = 60
const spokes = computed(() =>
  Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 - 90) * (Math.PI / 180)
    const at = (r: number) => `${(CENTRE + r * Math.cos(angle)).toFixed(1)} ${(CENTRE + r * Math.sin(angle)).toFixed(1)}`
    return `M${at(20)}L${at(43)}`
  }),
)

const rim = ref<SVGGElement | null>(null)
const spinning = ref(false)
let animation: Animation | null = null
let boost = 0

/** Where the wheel is right now, so a boost never snaps it back to zero. */
function currentAngle(): number {
  const el = rim.value
  if (!el) return 0
  const transform = getComputedStyle(el).transform
  if (!transform || transform === 'none') return 0
  try {
    const m = new DOMMatrixReadOnly(transform)
    return (Math.atan2(m.b, m.a) * 180) / Math.PI
  } catch {
    return 0
  }
}

function spin() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const running = spinning.value
  const from = currentAngle()
  boost = running ? Math.min(boost + 1, 6) : 1

  animation?.cancel()
  spinning.value = true
  animation = rim.value?.animate(
    [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${from + (2 + boost * 1.6) * 360}deg)` }],
    {
      duration: 1500 + boost * 380,
      // From rest it accelerates; a boost picks up the speed the wheel already has.
      easing: running ? 'cubic-bezier(0, 0, .22, 1)' : 'cubic-bezier(.45, 0, .18, 1)',
      fill: 'forwards',
    },
  ) ?? null
  animation?.finished.then(() => { spinning.value = false; boost = 0 }).catch(() => { /* cancelled by a boost */ })
}
</script>

<template>
  <span class="wheel" @mouseenter="spin" @focusin="spin">
    <svg :width="size" :height="size" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g ref="rim" class="wheel-rim" stroke="currentColor" stroke-linecap="round">
        <circle cx="60" cy="60" r="52" stroke-width="9" />
        <circle cx="60" cy="60" r="43" stroke-width="4" />
        <path v-for="(d, i) in spokes" :key="i" :d="d" stroke-width="7" />
        <circle cx="60" cy="60" r="12" stroke-width="7" />
      </g>
    </svg>
  </span>
</template>
