<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalcResult, Currency, FxRates, LineItem, Msg, RouteInput, Vehicle } from '../types'
import { fmt } from '../lib/money'
import rulesUa from '../data/rules.ukraine.json'
import rulesEs from '../data/rules.spain.json'
import countries from '../data/countries.json'
import { formatNumber, useI18n } from '../i18n'
import Help from './Help.vue'
import CountUp from './CountUp.vue'

const props = defineProps<{ result: CalcResult; vehicle: Vehicle; route: RouteInput; fx: FxRates }>()
const emit = defineEmits<{ share: [] }>()
const { t } = useI18n()
const cur = ref<Currency>(props.route.destination === 'UA' ? 'USD' : 'EUR')
const curOptions: { value: Currency; label: string }[] = [{ value: 'EUR', label: '€' }, { value: 'USD', label: '$' }, { value: 'UAH', label: '₴' }]
const taxes = computed(() => props.result.items.filter((i) => i.category === 'tax'))
const fees = computed(() => props.result.items.filter((i) => i.category === 'fees' && i.key !== 'conversion'))
const conversion = computed(() => props.result.items.find((i) => i.key === 'conversion'))
const legendLines = computed(() => [t('result.help.nuances'), t('result.notInSum', { tier: t(`result.tier.${props.vehicle.brandTier}`) })])
const tierCost = (n: { cost: Record<string, [number, number]> }) => n.cost[props.vehicle.brandTier]!
const refs = computed<Record<string, { title: string; url: string }>>(() => {
  if (props.route.destination === 'UA') return rulesUa.refs
  if (props.route.destination === 'ES') return rulesEs.refs
  const c = (countries.destinations as Record<string, { customs: string }>)[props.route.destination]!
  const r: Record<string, { title: string; url: string }> = { duty: countries.euDutySource, vat: countries.vatSource, customs: { title: new URL(c.customs).hostname, url: c.customs } }
  if (props.route.destination === 'PL') { r.plExcise = countries.poland.source; r.plDeclaration = countries.poland.declaration }
  if (props.route.destination === 'DE') { r.de = countries.germany.source; r.deRelocation = countries.germany.relocation }
  return r
})
const fxRef = rulesUa.refs.fx
const money = (v: number) => fmt(v, cur.value, props.fx)
const isRange = (it: LineItem) => Math.abs(it.range.max - it.range.min) >= 1
const nuanceCost = (c: [number, number]) => (c[0] === 0 && c[1] === 0 ? '—' : `${money(c[0])} – ${money(c[1])}`)
function msg(m?: Msg): string {
  if (!m) return ''
  if (m.key === 'join') { const a = JSON.parse(String(m.params?.a)) as Msg; const b = JSON.parse(String(m.params?.b)) as Msg; return `${msg(a)} ${msg(b)}` }
  const params = m.params ? Object.fromEntries(Object.entries(m.params).map(([k, v]) => [k, typeof v === 'number' ? formatNumber(v, Number.isInteger(v) ? 0 : 2) : v])) : undefined
  return t(m.key, params)
}
const helpLines = (it: LineItem) => [msg(it.note), it.estimate ? t('result.estimateNote') : ''].filter(Boolean)
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>{{ t('result.title') }} <Help :text="t('result.help')" /></h2>
      <div class="chips"><button v-for="c in curOptions" :key="c.value" type="button" class="chip" :class="{ on: cur === c.value }" @click="cur = c.value">{{ c.label }}</button></div>
    </div>
    <div class="total">
      <div class="n"><CountUp :value="result.total.likely" :format="money" /></div>
      <div class="r"><CountUp :value="result.total.min" :format="money" /> – <CountUp :value="result.total.max" :format="money" /></div>
    </div>

    <table class="lines">
      <tbody>
        <tr class="cat"><td colspan="3">{{ t('result.taxes') }} <Help :text="t('result.help.taxes')" /></td></tr>
        <tr v-for="it in taxes" :key="it.key">
          <td class="l"><span class="dot red"></span>{{ msg(it.label) }} <Help :lines="helpLines(it)" :formula="it.formula" :source="it.source" /></td>
          <td class="n dim">{{ isRange(it) ? `${money(it.range.min)} – ${money(it.range.max)}` : '' }}</td>
          <td class="n"><CountUp :value="it.range.likely" :format="money" /></td>
        </tr>
        <template v-if="fees.length || result.nuances.length">
          <tr class="cat"><td colspan="3">{{ t('result.fees') }} <Help :text="t('result.help.fees')" /></td></tr>
          <tr v-for="it in fees" :key="it.key">
            <td class="l"><span class="dot red"></span>{{ msg(it.label) }} <Help v-if="it.note || it.source || it.estimate" :lines="helpLines(it)" :source="it.source" /></td>
            <td class="n dim">{{ isRange(it) ? `${money(it.range.min)} – ${money(it.range.max)}` : '' }}</td>
            <td class="n"><CountUp :value="it.range.likely" :format="money" /></td>
          </tr>
          <template v-if="conversion">
            <tr>
              <td class="l"><span class="dot red"></span>{{ msg(conversion.label) }} <Help :lines="[msg(conversion.note), ...legendLines, t('result.estimateNote')]" /></td>
              <td class="n dim">{{ isRange(conversion) ? `${money(conversion.range.min)} – ${money(conversion.range.max)}` : '' }}</td>
              <td class="n"><CountUp :value="conversion.range.likely" :format="money" /></td>
            </tr>
            <tr v-for="n in result.nuances" :key="n.id" class="sub" :class="{ opt: n.required !== 'always' }">
              <td class="l"><span class="dot" :class="n.required === 'always' ? 'red' : n.required === 'likely' ? 'amber' : 'grey'" :title="t(`result.legend.${n.required}`)"></span>{{ t(`nuance.${n.id}.title`) }} <Help :text="t(`nuance.${n.id}.why`) + ' ' + t(`result.legend.${n.required}`) + '.'" /></td>
              <td class="n dim">{{ nuanceCost(tierCost(n)) }}</td>
              <td class="n"><CountUp v-if="n.required === 'always'" :value="(tierCost(n)[0] + tierCost(n)[1]) / 2" :format="money" /><span v-else class="dim">—</span></td>
            </tr>
          </template>
        </template>
        <tr class="sum"><td>{{ t('result.total') }}</td><td class="n dim">{{ money(result.total.min) }} – {{ money(result.total.max) }}</td><td class="n"><CountUp :value="result.total.likely" :format="money" /></td></tr>
      </tbody>
    </table>
    <p class="tiny">{{ t('result.customsValue', { value: money(result.customsValue) }) }} <Help :text="t(route.destination === 'UA' ? 'result.help.customsValueUa' : 'result.help.customsValueEu')" :source="refs.duty" /></p>

    <div v-if="result.notComputed.length" class="nc">
      <div class="nc-title">{{ t('result.notComputed') }}</div>
      <div v-for="n in result.notComputed" :key="n.key" class="nc-row"><span class="dot grey"></span><span>{{ t(`result.notComputed.${n.key}`) }}</span> <a :href="n.source.url" target="_blank" rel="noopener">{{ n.source.title }} ↗</a></div>
    </div>

    <details v-if="result.warnings.length"><summary>{{ t('result.warnings', { n: result.warnings.length }) }}</summary><ul class="body"><li v-for="(w, i) in result.warnings" :key="i">{{ msg(w) }}</li></ul></details>
    <details><summary>{{ t('result.steps') }}</summary><ol class="body"><li v-for="(c, i) in result.checklist" :key="i">{{ msg(c) }}</li></ol></details>
    <details><summary>{{ t('result.sources') }}</summary><ul class="body"><li v-for="(r, k) in refs" :key="k"><a :href="r.url" target="_blank" rel="noopener">{{ r.title }}</a></li><li><a :href="fxRef.url" target="_blank" rel="noopener">{{ t('result.fx', { date: fx.date, usd: fx.usdUah.toFixed(2), eur: fx.eurUah.toFixed(2) }) }}</a></li></ul></details>

    <div class="share"><slot name="share"><button type="button" class="btn" @click="emit('share')">{{ t('result.share') }}</button></slot></div>
  </div>
</template>
