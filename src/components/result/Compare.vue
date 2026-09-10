<script setup lang="ts">
import { computed } from 'vue'
import type { Currency, Destination, FxRates, Trip, Vehicle } from '../../types'
import { estimate } from '../../lib/calc'
import { DESTINATIONS } from '../../state/calculator'
import { format as formatMoney } from '../../lib/money'
import { useI18n } from '../../i18n'
import HelpTip from '../controls/HelpTip.vue'

/**
 * The same car, everywhere else. This is the one question a calculator that knows
 * 28 countries can answer and a calculator that knows one cannot — and the answer is
 * usually a surprise. A country whose tax we cannot put a number on is left out
 * rather than shown cheap, which is the whole trap this table could otherwise set.
 */
const props = defineProps<{ vehicle: Vehicle; trip: Trip; fx: FxRates; currency: Currency }>()
const { t, locale, region } = useI18n()

const SHOWN = 6

const ranked = computed(() => DESTINATIONS
  .map((code) => {
    const result = estimate(props.vehicle, { ...props.trip, destination: code }, props.fx)
    const regTax = result.lines.find((line) => line.id === 'regTax')
    return { code, total: result.total.likely, unknown: !!regTax?.unknown }
  })
  .filter((row) => !row.unknown)
  .sort((a, b) => a.total - b.total))

const here = computed(() => ranked.value.findIndex((row) => row.code === props.trip.destination))
const shown = computed(() => {
  const list = ranked.value
  if (here.value < 0 || here.value < SHOWN) return list.slice(0, SHOWN)
  // Far down the list: the cheapest few, then where this route actually sits.
  return [...list.slice(0, SHOWN - 1), list[here.value]!]
})

const money = (value: number) => formatMoney(value, props.currency, props.fx, locale.value)
const isHere = (code: Destination) => code === props.trip.destination
</script>

<template>
  <section v-if="ranked.length > 2" class="compare">
    <h3 class="compare-title">
      {{ t('result.compare') }}
      <HelpTip :text="t('result.compare.help')" />
    </h3>
    <ol class="compare-list">
      <li v-for="row in shown" :key="row.code" :class="{ on: isHere(row.code) }">
        <span class="compare-rank">{{ ranked.indexOf(row) + 1 }}</span>
        <span class="fi" :class="`fi-${row.code.toLowerCase()}`"></span>
        <span class="compare-name">{{ region(row.code) }}</span>
        <span class="compare-total">{{ money(row.total) }}</span>
      </li>
    </ol>
    <p class="compare-note">{{ t('result.compare.note', { shown: ranked.length }) }}</p>
  </section>
</template>
