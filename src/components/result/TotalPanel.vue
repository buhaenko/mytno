<script setup lang="ts">
import type { Currency, Estimate } from '../../types'
import { isRange } from '../../lib/money'
import { CURRENCIES } from '../../types'
import CountUp from './CountUp.vue'
import HelpTip from '../controls/HelpTip.vue'
import { ref } from 'vue'
import { useI18n } from '../../i18n'

/** The answer, before any of the detail. */
defineProps<{ estimate: Estimate; format: (v: number) => string; notice?: string }>()
const currency = defineModel<Currency>('currency', { required: true })
const { t } = useI18n()

/**
 * The address bar is the share link — but nobody copies an address bar on a phone,
 * which is what this button is for. It copies the same address, nothing else.
 */
const copied = ref(false)
async function copy() {
  try { await navigator.clipboard.writeText(location.href) } catch { return }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
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
      <span v-if="isRange(estimate.total)" class="total-range">
        <CountUp :value="estimate.total.min" :format="format" /> – <CountUp :value="estimate.total.max" :format="format" />
      </span>
    </p>
    <p v-if="notice" class="notice">{{ notice }}</p>
    <div class="total-foot">
      <button type="button" class="total-copy" @click="copy">{{ copied ? t('result.copied') : t('result.copy') }}</button>
    </div>
  </div>
</template>
