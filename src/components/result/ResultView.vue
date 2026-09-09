<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Currency, Estimate, FxRates, Msg, Trip, Vehicle } from '../../types'
import ukraine from '@config/rules.ukraine.json'
import spain from '@config/rules.spain.json'
import countries from '@config/countries.json'
import { format as formatMoney } from '../../lib/money'
import { useI18n } from '../../i18n'
import TotalPanel from './TotalPanel.vue'
import Breakdown from './Breakdown.vue'
import HelpTip from '../controls/HelpTip.vue'

const props = defineProps<{ estimate: Estimate; vehicle: Vehicle; trip: Trip; fx: FxRates }>()
const { t, locale } = useI18n()

const currency = ref<Currency>(props.trip.destination === 'UA' ? 'USD' : 'EUR')
const format = (value: number) => formatMoney(value, currency.value, props.fx, locale.value)
const translate = (m: Msg) => t(m.key, m.params)

/** Every source behind the numbers, so the reader can check any of them. */
const sources = computed<Record<string, { title: string; url: string }>>(() => {
  if (props.trip.destination === 'UA') return ukraine.refs
  if (props.trip.destination === 'ES') return spain.refs
  const country = (countries.destinations as Record<string, { customs: string }>)[props.trip.destination]!
  const list: Record<string, { title: string; url: string }> = {
    duty: countries.euDutySource,
    vat: countries.vatSource,
    customs: { title: new URL(country.customs).hostname.replace('www.', ''), url: country.customs },
  }
  if (props.trip.destination === 'PL') list.excise = countries.poland.source
  if (props.trip.destination === 'AT') list.regTax = countries.austria.source
  return list
})
const rateSource = ukraine.refs.fx
</script>

<template>
  <div>
    <TotalPanel
      v-model:currency="currency"
      :estimate="estimate"
      :format="format"
      :notice="estimate.notice && translate(estimate.notice)"
    />

    <div class="card breakdown-card">
      <Breakdown :estimate="estimate" :tier="vehicle.brandTier" :format="format" :translate="translate" />

      <p class="hint">
        {{ t('result.customsValue', { value: format(estimate.customsValue) }) }}
        <HelpTip :text="t(trip.destination === 'UA' ? 'result.help.customsValueUa' : 'result.help.customsValueEu')" :source="sources.duty" />
      </p>

      <details v-if="estimate.warnings.length">
        <summary>{{ t('result.warnings', { n: estimate.warnings.length }) }}</summary>
        <ul class="disclosure"><li v-for="(w, i) in estimate.warnings" :key="i">{{ translate(w) }}</li></ul>
      </details>

      <details>
        <summary>{{ t('result.steps') }}</summary>
        <ol class="disclosure"><li v-for="(step, i) in estimate.steps" :key="i">{{ translate(step) }}</li></ol>
      </details>

      <details>
        <summary>{{ t('result.sources') }}</summary>
        <ul class="disclosure">
          <li v-for="(source, key) in sources" :key="key"><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }}</a></li>
          <li>
            <a :href="rateSource.url" target="_blank" rel="noopener noreferrer">
              {{ t('result.fx', { date: fx.date, usd: fx.usdUah.toFixed(2), eur: fx.eurUah.toFixed(2) }) }}
            </a>
          </li>
        </ul>
      </details>
    </div>
  </div>
</template>
