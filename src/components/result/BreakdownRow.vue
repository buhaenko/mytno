<script setup lang="ts">
import type { Line } from '../../types'
import { isRange } from '../../lib/money'
import CountUp from './CountUp.vue'
import HelpTip from '../controls/HelpTip.vue'
import { useI18n } from '../../i18n'

/** One line of the breakdown: what it is, what it might be, what we expect it to be. */
const props = defineProps<{ line: Line; format: (v: number) => string; translate: (m: { key: string; params?: Record<string, string | number> }) => string }>()
const { t } = useI18n()

const notes = () => [
  ...(props.line.notes ?? []).map(props.translate),
  ...(props.line.estimate ? [t('result.estimateNote')] : []),
]
</script>

<template>
  <tr :class="{ unknown: line.unknown }">
    <td class="cell-name">
      <span class="dot" :class="line.unknown ? 'hollow' : 'due'"></span>
      {{ translate(line.label) }}
      <HelpTip v-if="notes().length || line.source || line.formula" :notes="notes()" :formula="line.formula" :source="line.source" />
    </td>
    <td class="cell-range">
      <template v-if="line.unknown">{{ t('result.notInTotal') }}</template>
      <template v-else-if="isRange(line.amount)">{{ format(line.amount.min) }} – {{ format(line.amount.max) }}</template>
    </td>
    <td class="cell-amount">
      <span v-if="line.unknown" class="muted">—</span>
      <CountUp v-else :value="line.amount.likely" :format="format" />
    </td>
  </tr>
</template>
