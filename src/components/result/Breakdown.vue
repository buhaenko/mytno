<script setup lang="ts">
import { computed } from 'vue'
import type { BrandTier, Estimate, Msg, Nuance } from '../../types'
import { isRange } from '../../lib/money'
import CountUp from './CountUp.vue'
import BreakdownRow from './BreakdownRow.vue'
import HelpTip from '../controls/HelpTip.vue'
import { useI18n } from '../../i18n'

/** Taxes first, then what the registration itself costs, then the total. */
const props = defineProps<{
  estimate: Estimate
  tier: BrandTier
  format: (v: number) => string
  translate: (m: Msg) => string
}>()
const { t } = useI18n()

const taxes = computed(() => props.estimate.lines.filter((l) => l.kind === 'tax'))
const fees = computed(() => props.estimate.lines.filter((l) => l.kind === 'fee' && l.id !== 'conversion'))
const conversion = computed(() => props.estimate.lines.find((l) => l.id === 'conversion'))

const cost = (n: Nuance) => n.cost[props.tier]
const nuancePrice = (n: Nuance) => {
  const [min, max] = cost(n)
  return min === 0 && max === 0 ? '—' : `${props.format(min)} – ${props.format(max)}`
}
const nuanceAmount = (n: Nuance) => (cost(n)[0] + cost(n)[1]) / 2
const dotOf = (n: Nuance) => (n.required === 'always' ? 'due' : n.required === 'likely' ? 'likely' : 'maybe')
</script>

<template>
  <table class="breakdown">
    <tbody>
      <tr class="group"><td colspan="3">{{ t('result.taxes') }} <HelpTip :text="t('result.help.taxes')" /></td></tr>
      <BreakdownRow v-for="line in taxes" :key="line.id" :line="line" :format="format" :translate="translate" />

      <template v-if="fees.length || conversion">
        <tr class="group"><td colspan="3">{{ t('result.fees') }} <HelpTip :text="t('result.help.fees')" /></td></tr>
        <BreakdownRow v-for="line in fees" :key="line.id" :line="line" :format="format" :translate="translate" />

        <template v-if="conversion">
          <BreakdownRow
            :line="{ ...conversion, notes: [...(conversion.notes ?? [])] }"
            :format="format"
            :translate="translate"
          />
          <tr v-for="n in estimate.nuances" :key="n.id" class="sub" :class="{ optional: n.required !== 'always' }">
            <td class="cell-name">
              <span class="dot" :class="dotOf(n)" :title="t(`result.legend.${n.required}`)"></span>
              {{ t(`nuance.${n.id}.title`) }}
              <HelpTip :text="`${t(`nuance.${n.id}.why`)} ${t(`result.legend.${n.required}`)}.`" />
            </td>
            <td class="cell-range">{{ nuancePrice(n) }}</td>
            <td class="cell-amount">
              <CountUp v-if="n.required === 'always'" :value="nuanceAmount(n)" :format="format" />
              <span v-else class="muted">—</span>
            </td>
          </tr>
        </template>
      </template>

      <tr class="total">
        <td>{{ t('result.total') }}</td>
        <td class="cell-range">
          <template v-if="isRange(estimate.total)">{{ format(estimate.total.min) }} – {{ format(estimate.total.max) }}</template>
        </td>
        <td class="cell-amount"><CountUp :value="estimate.total.likely" :format="format" /></td>
      </tr>
    </tbody>
  </table>
</template>
