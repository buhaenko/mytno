<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalcResult, Category, Currency, FxRates, LineItem, RouteInput, Vehicle } from '../types'
import { fmt } from '../lib/money'
import rulesUa from '../data/rules.ukraine.json'
import rulesEs from '../data/rules.spain.json'
import Chips from './Chips.vue'
import Help from './Help.vue'

const props = defineProps<{ result: CalcResult; vehicle: Vehicle; route: RouteInput; fx: FxRates }>()
const cur = ref<Currency>(props.route.destination === 'UA' ? 'USD' : 'EUR')
const curOptions: { value: Currency; label: string }[] = [{ value: 'EUR', label: '€' }, { value: 'USD', label: '$' }, { value: 'UAH', label: '₴' }]
const copied = ref(false)

const CATS: { key: Category; label: string }[] = [
  { key: 'tax', label: 'Обов\'язкові платежі' }, { key: 'logistics', label: 'Логістика' }, { key: 'compliance', label: 'Сертифікація та переобладнання' },
  { key: 'fees', label: 'Оформлення' }, { key: 'repair', label: 'Ремонт' },
]
const grouped = computed(() => CATS.map((c) => ({ ...c, items: props.result.items.filter((i) => i.category === c.key) })).filter((g) => g.items.length))
const other = computed(() => props.result.total.likely - props.result.taxesTotal.likely)
const refs = computed(() => (props.route.destination === 'UA' ? rulesUa.refs : rulesEs.refs) as Record<string, { title: string; url: string }>)
const fxRef = rulesUa.refs.fx
const money = (v: number) => fmt(v, cur.value, props.fx)
const isRange = (it: LineItem) => Math.abs(it.range.max - it.range.min) >= 1
const reqLabel = { always: 'обов\'язково', likely: 'найімовірніше', sometimes: 'іноді' }
const nuanceCost = (c: [number, number]) => (c[0] === 0 && c[1] === 0 ? '—' : `${money(c[0])} – ${money(c[1])}`)
function helpLines(it: LineItem) {
  const l: string[] = []
  if (it.note) l.push(it.note)
  if (it.estimate) l.push('Ринкова оцінка за типовими цінами 2026, не офіційна ставка.')
  return l
}
async function copyLink() {
  try { await navigator.clipboard.writeText(location.href); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch { /* noop */ }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2 style="margin:0">Розмитнення та облік <Help text="Усе поверх ціни авто: податки за офіційними ставками, доставка, сертифікація, оформлення. Три сценарії — мінімум (усе гладко), реалістично, максимум (митниця переоцінила, усе нове). Ціна авто в суму не входить." /></h2>
      <Chips v-model="cur" :options="curOptions" />
    </div>
    <div class="total">
      <div class="n">{{ money(result.total.likely) }}</div>
      <div class="r">{{ money(result.total.min) }} – {{ money(result.total.max) }}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="k">Податки та збори <Help text="Тільки платежі державі за офіційними ставками." /></div><div class="v">{{ money(result.taxesTotal.likely) }}</div></div>
      <div class="kpi"><div class="k">Супутні витрати <Help text="Доставка, брокер, сертифікація, омологація, переобладнання, реєстрація. Ринкові оцінки." /></div><div class="v">{{ money(other) }}</div></div>
      <div class="kpi"><div class="k">Митна вартість <Help :text="route.destination === 'UA' ? 'Ціна + доставка до кордону. Митниця звіряє з довідниками і може підняти.' : 'CIF: ціна + доставка + страховка до кордону ЄС. База для мита; IVA рахується від CIF + мито.'" :source="refs.duty" /></div><div class="v">{{ money(result.customsValue) }}</div></div>
    </div>

    <table class="lines">
      <tbody>
        <template v-for="g in grouped" :key="g.key">
          <tr class="cat"><td colspan="3">{{ g.label }}</td></tr>
          <tr v-for="it in g.items" :key="it.key">
            <td class="l">{{ it.label }} <Help v-if="it.note || it.formula || it.source || it.estimate" :lines="helpLines(it)" :formula="it.formula" :source="it.source" /></td>
            <td class="n dim">{{ isRange(it) ? `${money(it.range.min)} – ${money(it.range.max)}` : '' }}</td>
            <td class="n">{{ money(it.range.likely) }}</td>
          </tr>
        </template>
        <tr class="sum"><td>Разом</td><td class="n dim">{{ money(result.total.min) }} – {{ money(result.total.max) }}</td><td class="n">{{ money(result.total.likely) }}</td></tr>
      </tbody>
    </table>

    <details v-if="result.warnings.length">
      <summary>Зверніть увагу ({{ result.warnings.length }})</summary>
      <ul class="body"><li v-for="(w, i) in result.warnings" :key="i">{{ w }}</li></ul>
    </details>

    <div v-if="result.nuances.length" style="margin-top:22px">
      <h2>Нюанси <Help text="Що доведеться доробити саме на цьому авто (за ринком походження) і скільки це коштує на подібних моделях вашого класу бренду." /></h2>
      <div v-for="n in result.nuances" :key="n.id" class="nu">
        <div class="t"><span class="req" :class="n.required">{{ reqLabel[n.required] }}</span>{{ n.title }} <Help :text="n.why + (n.howTo ? ' ' + n.howTo : '')" /></div>
        <div class="c">{{ nuanceCost(n.cost[vehicle.brandTier]) }}</div>
      </div>
    </div>

    <details>
      <summary>Порядок дій</summary>
      <ol class="body"><li v-for="(c, i) in result.checklist" :key="i">{{ c }}</li></ol>
    </details>
    <details>
      <summary>Джерела ставок</summary>
      <ul class="body"><li v-for="(r, k) in refs" :key="k"><a :href="r.url" target="_blank" rel="noopener">{{ r.title }}</a></li><li><a :href="fxRef.url" target="_blank" rel="noopener">{{ fxRef.title }}</a> — {{ fx.date }}: $ {{ fx.usdUah.toFixed(2) }}, € {{ fx.eurUah.toFixed(2) }}</li></ul>
    </details>

    <p class="foot"><button class="link" @click="copyLink">{{ copied ? 'Скопійовано' : 'Скопіювати посилання на розрахунок' }}</button></p>
  </div>
</template>
