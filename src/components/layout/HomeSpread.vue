<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import models from '@config/models.json'
import countries from '@config/countries.json'
import type { Currency, Destination, FxRates, Vehicle } from '../../types'
import { estimate } from '../../lib/calc'
import { averageOrder, spread, type SpreadRow } from '../../lib/spread'
import { carName, carVehicle, rotation, type CarModel } from '../../lib/cars'
import { DESTINATIONS } from '../../state/calculator'
import { format as formatMoney } from '../../lib/money'
import { useI18n } from '../../i18n'

/**
 * The first screen: one car priced in every country that can answer, cheapest first.
 *
 * On the bare home page it does not stand still. A dozen ordinary cars take turns — a Golf,
 * a Model 3, an X5 — and for each one the bars grow and shrink and the figures count from the
 * old number to the new. That movement is the argument: a static table says the tax differs
 * by country; a table that redraws itself when the car changes says it differs by *car*.
 *
 * The order of the countries does **not** change with the car, and that is deliberate. Sorting
 * each car afresh moved twenty-five rows of twenty-eight, several of them four hundred pixels,
 * every few seconds — rows crossing each other in every direction. No easing rescues that; it
 * is too much motion, not the wrong motion. A bar chart race works because one year differs
 * from the last by a place or two, and a Golf differs from an X5 by the whole table.
 *
 * The answer was to cut the field, not the motion. The twelve countries that charge the most
 * on average across the rotation are chosen once and never change; inside that dozen they sort
 * themselves for each car, so the ladder always descends. Twelve rows crossing at most eleven
 * places is the scale every bar-chart race works at — twenty-eight rows flying four hundred
 * pixels was not the wrong easing, it was too much of the right one. Denmark keeps its place at the top and its bar collapses to
 * nothing when the electric car comes round, which says more than watching it fly to the floor.
 *
 * A model page hands in its own car and the cycling stops: there the reader came for one car.
 */
const props = defineProps<{ fx: FxRates; currency: Currency; car?: Vehicle; price?: number; carLabel?: string }>()
const { t, locale, region } = useI18n()

const cars = rotation(models as CarModel[])

const still = computed(() => !!props.car)
const index = ref(0)
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const current = computed(() => {
  if (props.car) return { vehicle: props.car, label: props.carLabel ?? '', price: props.price ?? 0 }
  const car = cars[index.value % cars.length]!
  const engine = car.engines[0]!
  return { vehicle: carVehicle(car, engine), label: `${carName(car)} ${car.years[1] ?? car.years[0]}`, price: engine.listEur }
})

const tripFor = (price: number) =>
  ({ origin: 'EU' as const, price, currency: 'EUR' as Currency, hasOriginProof: true, residenceTransfer: false, region: 'FL' as const })

const ladderFor = (vehicle: Vehicle, price: number) =>
  spread(estimate, vehicle, tripFor(price), DESTINATIONS as Destination[], props.fx)

/** One order for the whole rotation: the average bill, dearest first. Computed once. */
/** Twelve is as many bars as read at a glance; the rest are a click away in the calculator. */
const SHOWN = 12
const everywhere = computed(() => props.car
  ? []
  : averageOrder(cars.map((car) => ladderFor(carVehicle(car, car.engines[0]!), car.engines[0]!.listEur))))
const order = computed(() => everywhere.value.slice(0, SHOWN))

/** Every country, for the sentence underneath; only the shown dozen have bars. */
const all = computed(() => ladderFor(current.value.vehicle, current.value.price))

const rows = computed<SpreadRow[]>(() => {
  const own = all.value
  if (props.car) return own
  const by = new Map(own.map((row) => [row.code, row]))
  const shown = order.value.map((code) => by.get(code) ?? { code, total: 0, share: 0 })
  shown.sort((a, b) => b.total - a.total)
  const most = shown[0]?.total ?? 1
  return shown.map((row) => ({ ...row, share: most > 0 ? row.total / most : 0 }))
})

/**
 * The figures count rather than jump. Text cannot be transitioned in CSS, so each amount is
 * walked from where it was to where it is going over the same time the bars take to move.
 */
const shown = ref(new Map<string, number>())
let frame = 0
watch(rows, (next, previous) => {
  if (reduced || !previous) {
    shown.value = new Map(next.map((r) => [r.code, r.total]))
    return
  }
  const from = new Map(shown.value)
  const started = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / 1000)
    // The same ease-in-out the rows move on, so nothing arrives ahead of anything else.
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    shown.value = new Map(next.map((r) => [r.code, (from.get(r.code) ?? r.total) + (r.total - (from.get(r.code) ?? r.total)) * eased]))
    if (t < 1) frame = requestAnimationFrame(step)
  }
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(step)
}, { immediate: true })

/**
 * The two ends of the bar scale belong to the palette, so they are read off the stylesheet.
 * Read in `onMounted` and held in a ref: as a computed this ran during the first render,
 * before the stylesheet had applied, got nothing, fell back and cached the fallback for the
 * life of the page — so the palette could be changed and the bars would never notice.
 */
const rgb = (name: string, fallback: number[]) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  return hex ? [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16)) : fallback
}
const scale = ref({ from: [205, 206, 212], to: [226, 102, 42] })

let timer = 0
onMounted(() => {
  scale.value = { from: rgb('--bar-low', scale.value.from), to: rgb('--bar-high', scale.value.to) }
  if (still.value || reduced || cars.length < 2) return
  timer = window.setInterval(() => (index.value += 1), 4800)
})
onBeforeUnmount(() => { clearInterval(timer); cancelAnimationFrame(frame) })

/** What the site covers, counted from the config: never the number of rows that happen to fit. */
const DESTINATION_COUNT = Object.keys(countries.destinations).length

/**
 * The bar takes its colour from the amount, not only its length. A row of identical grey
 * rectangles makes the reader compare twelve lengths; a scale lets them see the shape of the
 * answer before reading a single figure. Mixed in JS rather than with `color-mix`, because
 * the last thing this chart needed was another CSS feature that works in one browser.
 */
const barColour = (share: number) => {
  const { from, to } = scale.value
  const k = Math.min(1, share ** 0.6)
  return `rgb(${from.map((c, i) => Math.round(c + (to[i]! - c) * k)).join(' ')})`
}

const money = (value: number) => formatMoney(Math.round(value), props.currency, props.fx, locale.value)
const amount = (row: SpreadRow) => {
  const value = shown.value.get(row.code) ?? row.total
  return value < 1 ? t('home.spread.nothing') : money(value)
}
/** The extremes are this car's own across every country, not only the dozen on screen. */
const sorted = computed(() => [...(props.car ? rows.value : all.value)].sort((a, b) => b.total - a.total))
const dearest = computed(() => sorted.value[0])
const cheapest = computed(() => sorted.value.at(-1))
/**
 * The ladder is as tall as the tallest car in the rotation and stays that way. One country
 * can drop in or out between cars — Hungary answers for a 2021 car and not for a 2017 one —
 * and without a reserved height everything underneath would step up and down with it.
 */
const ROW_HEIGHT = 30
const tallest = computed(() => (props.car ? rows.value.length : order.value.length))
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const note = computed(() => t('home.spread.note', {
  low: `${escape(region(cheapest.value!.code))} — ${cheapest.value!.total < 1 ? t('home.spread.nothing') : escape(money(cheapest.value!.total))}`,
  high: `${escape(region(dearest.value!.code))} — ${escape(money(dearest.value!.total))}`,
  shown: rows.value.length,
  computed: all.value.length,
  destinations: DESTINATION_COUNT,
}))
</script>

<template>
  <section v-if="rows.length > 4" class="spread">
    <header class="spread-head">
      <h2>{{ carLabel
        ? t('page.car.h1', { car: carLabel, destinations: DESTINATION_COUNT })
        : t('home.spread.title', { destinations: DESTINATION_COUNT }) }}</h2>
      <p class="spread-terms">
        <Transition name="swap" mode="out-in"><b :key="current.label" class="spread-car">{{ current.label }}</b></Transition>
        <span>{{ t('home.spread.car', { price: money(current.price) }) }}</span>
      </p>
    </header>

    <TransitionGroup tag="ol" name="ladder" class="spread-list" :style="{ minHeight: `${tallest * ROW_HEIGHT}px` }">
      <li
        v-for="row in rows" :key="row.code"
        :class="{ low: row.code === cheapest?.code, high: row.code === dearest?.code }"
      >
        <span class="fi" :class="`fi-${row.code.toLowerCase()}`"></span>
        <span class="spread-name">{{ region(row.code) }}</span>
        <span class="spread-bar"><i :style="{ width: `${Math.round(row.share * 1000) / 10}%`, background: barColour(row.share) }"></i></span>
        <span class="spread-total">{{ amount(row) }}</span>
      </li>
    </TransitionGroup>

    <p class="spread-note" v-html="note"></p>
  </section>
</template>
