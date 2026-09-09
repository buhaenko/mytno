<script setup lang="ts">
import type { Currency, Estimate } from '../../types'
import { CURRENCIES } from '../../types'
import CountUp from './CountUp.vue'
import HelpTip from '../controls/HelpTip.vue'
import { useI18n } from '../../i18n'

/** The answer, before any of the detail. */
defineProps<{ estimate: Estimate; format: (v: number) => string; notice?: string }>()
const currency = defineModel<Currency>('currency', { required: true })
const { t } = useI18n()
</script>

<template>
  <div class="total-panel">
    <div class="total-head">
      <h2>{{ t('result.title') }} <HelpTip :text="t('result.help')" /></h2>
      <select v-model="currency" class="total-currency" :aria-label="t('result.currency')">
        <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>
    <p class="total-figure">
      <CountUp class="total-value" :value="estimate.total.likely" :format="format" />
      <span class="total-range">
        <CountUp :value="estimate.total.min" :format="format" /> – <CountUp :value="estimate.total.max" :format="format" />
      </span>
    </p>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>
