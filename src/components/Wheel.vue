<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// Sporty five-spoke alloy wheel, black and white.
// Hovering spins it up; hovering again while it turns adds momentum instead of
// restarting it, and it always coasts to a smooth stop.
const props = withDefaults(defineProps<{ size?: number }>(), { size: 120 })

const C = 60
const polar = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const
const f = (n: number) => n.toFixed(1)
/** five tapered spokes: wide at the hub, narrow at the rim */
const spokes = computed(() =>
  Array.from({ length: 5 }, (_, i) => {
    const a = (i * 72 - 90) * (Math.PI / 180)
    const [x1, y1] = polar(17, a - 0.34)
    const [x2, y2] = polar(38.5, a - 0.15)
    const [x3, y3] = polar(38.5, a + 0.15)
    const [x4, y4] = polar(17, a + 0.34)
    return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A38.5 38.5 0 0 1 ${f(x3)} ${f(y3)}L${f(x4)} ${f(y4)}A17 17 0 0 0 ${f(x1)} ${f(y1)}Z`
  }),
)
const lugs = computed(() => Array.from({ length: 5 }, (_, i) => polar(10, (i * 72 - 54) * (Math.PI / 180))))
/** tread blocks, so the rotation reads on the tyre too */
const tread = computed(() =>
  Array.from({ length: 18 }, (_, i) => {
    const a = i * 20 * (Math.PI / 180)
    const [x1, y1] = polar(45, a)
    const [x2, y2] = polar(53, a)
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
      <g ref="rim" class="rim">
        <path d="M60 3a57 57 0 1 1 0 114A57 57 0 0 1 60 3Zm0 15a42 42 0 1 0 0 84 42 42 0 0 0 0-84Z" fill="currentColor" fill-rule="evenodd" />
        <g stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round" opacity=".55">
          <path v-for="(d, i) in tread" :key="i" :d="d" />
        </g>
        <circle cx="60" cy="60" r="42" fill="var(--bg)" />
        <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="2.5" />
        <path v-for="(d, i) in spokes" :key="i" :d="d" fill="currentColor" />
        <circle cx="60" cy="60" r="17" fill="var(--bg)" stroke="currentColor" stroke-width="2.5" />
        <circle cx="60" cy="60" r="5.5" fill="currentColor" />
        <circle v-for="([x, y], i) in lugs" :key="i" :cx="x" :cy="y" r="2" fill="currentColor" />
      </g>
    </svg>
  </span>
</template>
