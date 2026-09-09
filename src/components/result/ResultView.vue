<script setup lang="ts">
import { computed } from 'vue'
import type { Currency, Estimate, Foreign, FxRates, Msg, Trip, Vehicle } from '../../types'
import ukraine from '@config/rules.ukraine.json'
import spain from '@config/rules.spain.json'
import countries from '@config/countries.json'
import netherlands from '@config/rules.netherlands.json'
import portugal from '@config/rules.portugal.json'
import lithuania from '@config/rules.lithuania.json'
import slovakia from '@config/rules.slovakia.json'
import italy from '@config/rules.italy.json'
import slovenia from '@config/rules.slovenia.json'
import hungary from '@config/rules.hungary.json'
import france from '@config/rules.france.json'
import { format as formatMoney } from '../../lib/money'
import { useI18n } from '../../i18n'
import TotalPanel from './TotalPanel.vue'
import Breakdown from './Breakdown.vue'
import HelpTip from '../controls/HelpTip.vue'

const props = defineProps<{ estimate: Estimate; vehicle: Vehicle; trip: Trip; fx: FxRates }>()
const currency = defineModel<Currency>('currency', { required: true })
const { t, locale } = useI18n()
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
  if (props.trip.destination === 'NL') list.regTax = netherlands.source
  if (props.trip.destination === 'CZ') list.regTax = countries.czechia.source
  if (props.trip.destination === 'PT') list.regTax = portugal.source
  if (props.trip.destination === 'LT') list.regTax = lithuania.source
  if (props.trip.destination === 'SK') list.regTax = slovakia.source
  if (props.trip.destination === 'IT') list.regTax = italy.source
  if (props.trip.destination === 'SI') list.regTax = slovenia.source
  if (props.trip.destination === 'HU') list.regTax = hungary.source
  if (props.trip.destination === 'FR') list.regTax = france.source
  return list
})
const { _note, ...rates } = countries.fxSources

/** Only the rates this calculation leaned on: what the price was paid in, what the total is read in. */
const used = computed(() =>
  [...new Set<Currency>([props.trip.currency, currency.value])]
    .filter((c): c is Foreign => c !== 'EUR')
    .map((code) => ({ code, quote: props.fx[code] })))
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
          <li v-for="rate in used" :key="rate.code">
            <a :href="rates[rate.quote.source].url" target="_blank" rel="noopener noreferrer">
              {{ t('result.fx', {
                bank: rates[rate.quote.source].short,
                date: rate.quote.date,
                rate: rate.quote.rate.toFixed(rate.quote.rate < 10 ? 4 : 2),
                code: rate.code,
              }) }}
            </a>
          </li>
        </ul>
      </details>
    </div>
  </div>
</template>
