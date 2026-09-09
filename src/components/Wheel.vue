<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// Sporty five-spoke alloy wheel, black and white.
// Hovering spins it up; hovering again while it turns adds momentum instead of
// restarting it, and it always coasts to a smooth stop.
const props = withDefaults(defineProps<{ size?: number }>(), { size: 120 })

const C = 60
const polar = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const
const f = (n: number) => n.toFixed(1)
/** five straight spokes from the hub to the rim */
const spokes = computed(() =>
  Array.from({ length: 5 }, (_, i) => {
    const a = (i * 72 - 90) * (Math.PI / 180)
    const [x1, y1] = polar(20, a)
    const [x2, y2] = polar(43, a)
    return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`
  }),
)

const rim = ref<SVGGElement | null>(null)
const spinning = ref(false)
let anim: Animation | null = null
let boost = 0

/** where the wheel actually is right now, so a boost never snaps it back */
function currentAngle(): number {
  const el = rim.value
  if (!el) return 0
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 0
  try {
    const m = new DOMMatrixReadOnly(t)
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
  const turns = 2 + boost * 1.6
  const duration = 1500 + boost * 380
  anim?.cancel()
  spinning.value = true
  anim = rim.value?.animate(
    [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${from + turns * 360}deg)` }],
    // first spin accelerates from rest; a boost picks up where the wheel already is
    { duration, easing: running ? 'cubic-bezier(0, 0, .22, 1)' : 'cubic-bezier(.45, 0, .18, 1)', fill: 'forwards' },
  ) ?? null
  anim?.finished.then(() => { spinning.value = false; boost = 0 }).catch(() => { /* cancelled by a boost */ })
}
onMounted(() => { /* the wheel only moves on hover */ })
</script>

<template>
  <span class="wheelwrap" :class="{ spinning }" @mouseenter="spin()" @focusin="spin()">
    <svg class="wheel" :width="size" :height="size" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g ref="rim" class="rim" stroke="currentColor" stroke-linecap="round">
        <circle cx="60" cy="60" r="52" stroke-width="9" />
        <circle cx="60" cy="60" r="43" stroke-width="4" />
        <path v-for="(d, i) in spokes" :key="i" :d="d" stroke-width="7" />
        <circle cx="60" cy="60" r="12" stroke-width="7" />
      </g>
    </svg>
  </span>
</template>
