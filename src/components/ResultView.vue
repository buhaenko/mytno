<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalcResult, Currency, FxRates, LineItem, RouteInput, Vehicle } from '../types'
import { fmt } from '../lib/money'
import rulesUa from '../data/rules.ukraine.json'
import rulesEs from '../data/rules.spain.json'
import Help from './Help.vue'
import CountUp from './CountUp.vue'

const props = defineProps<{ result: CalcResult; vehicle: Vehicle; route: RouteInput; fx: FxRates; shareUrl: string }>()
const cur = ref<Currency>(props.route.destination === 'UA' ? 'USD' : 'EUR')
const curOptions: { value: Currency; label: string }[] = [{ value: 'EUR', label: '€' }, { value: 'USD', label: '$' }, { value: 'UAH', label: '₴' }]
const taxes = computed(() => props.result.items.filter((i) => i.category === 'tax'))
const fees = computed(() => props.result.items.filter((i) => i.category === 'fees'))
const refs = computed(() => (props.route.destination === 'UA' ? rulesUa.refs : rulesEs.refs) as Record<string, { title: string; url: string }>)
const fxRef = rulesUa.refs.fx
const money = (v: number) => fmt(v, cur.value, props.fx)
const isRange = (it: LineItem) => Math.abs(it.range.max - it.range.min) >= 1
const reqLabel = { always: 'обов\'язково', likely: 'найімовірніше', sometimes: 'іноді' }
const nuanceCost = (c: [number, number]) => (c[0] === 0 && c[1] === 0 ? '—' : `${money(c[0])} – ${money(c[1])}`)
const helpLines = (it: LineItem) => [it.note, it.estimate ? 'Ринкова ціна послуги, не державна ставка.' : undefined].filter((x): x is string => !!x)
const copied = ref(false)
const shown = ref(false)
async function share() {
  shown.value = true
  try { await navigator.clipboard.writeText(props.shareUrl); copied.value = true; setTimeout(() => (copied.value = false), 2000) } catch { /* noop */ }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Розмитнення <Help text="Податки за офіційними ставками та обов'язкові збори за постановку на облік. Ціна авто, доставка, брокери й ремонт сюди не входять. Діапазон: від «усе гладко» до «митниця переоцінила на 15%»." /></h2>
      <div class="chips"><button v-for="c in curOptions" :key="c.value" type="button" class="chip" :class="{ on: cur === c.value }" @click="cur = c.value">{{ c.label }}</button></div>
    </div>
    <div class="total">
      <div class="n"><CountUp :value="result.total.likely" :format="money" /></div>
      <div class="r">{{ money(result.total.min) }} – {{ money(result.total.max) }}</div>
    </div>

    <table class="lines">
      <tbody>
        <tr class="cat"><td colspan="3">Податки <Help text="Платежі державі за ставками з законодавства." /></td></tr>
        <tr v-for="it in taxes" :key="it.key">
          <td class="l">{{ it.label }} <Help :lines="helpLines(it)" :formula="it.formula" :source="it.source" /></td>
          <td class="n dim">{{ isRange(it) ? `${money(it.range.min)} – ${money(it.range.max)}` : '' }}</td>
          <td class="n">{{ money(it.range.likely) }}</td>
        </tr>
        <tr class="cat"><td colspan="3">Облік <Help text="Обов'язкові збори та сертифікація, без яких авто не зареєструють." /></td></tr>
        <tr v-for="it in fees" :key="it.key">
          <td class="l">{{ it.label }} <Help v-if="it.note || it.source || it.estimate" :lines="helpLines(it)" :source="it.source" /></td>
          <td class="n dim">{{ isRange(it) ? `${money(it.range.min)} – ${money(it.range.max)}` : '' }}</td>
          <td class="n">{{ money(it.range.likely) }}</td>
        </tr>
        <tr class="sum"><td>Разом</td><td class="n dim">{{ money(result.total.min) }} – {{ money(result.total.max) }}</td><td class="n">{{ money(result.total.likely) }}</td></tr>
      </tbody>
    </table>
    <p class="tiny">Митна вартість {{ money(result.customsValue) }} <Help :text="route.destination === 'UA' ? 'Ціна + доставка до кордону. Митниця звіряє з довідниками і може підняти — це верхня межа діапазону.' : 'CIF: ціна + доставка та страховка до кордону ЄС. База для мита; IVA рахується від CIF + мито.'" :source="refs.duty" /></p>

    <details v-if="result.warnings.length"><summary>Зверніть увагу ({{ result.warnings.length }})</summary><ul class="body"><li v-for="(w, i) in result.warnings" :key="i">{{ w }}</li></ul></details>
    <details v-if="result.nuances.length">
      <summary>Переобладнання та нюанси ({{ result.nuances.length }})</summary>
      <div class="body" style="padding-left:0">
        <div v-for="n in result.nuances" :key="n.id" class="nu">
          <div class="t"><span class="req" :class="n.required">{{ reqLabel[n.required] }}</span>{{ n.title }} <Help :text="n.why + (n.howTo ? ' ' + n.howTo : '')" /></div>
          <div class="c">{{ nuanceCost(n.cost[vehicle.brandTier]) }}</div>
        </div>
        <p class="tiny" style="margin-top:6px">Не входить у суму. Ціни запчастин і робіт на подібних авто класу «{{ { mass: 'масовий', premium: 'преміум', luxury: 'люкс' }[vehicle.brandTier] }}».</p>
      </div>
    </details>
    <details><summary>Порядок дій</summary><ol class="body"><li v-for="(c, i) in result.checklist" :key="i">{{ c }}</li></ol></details>
    <details><summary>Джерела</summary><ul class="body"><li v-for="(r, k) in refs" :key="k"><a :href="r.url" target="_blank" rel="noopener">{{ r.title }}</a></li><li><a :href="fxRef.url" target="_blank" rel="noopener">{{ fxRef.title }}</a>, {{ fx.date }}: $ {{ fx.usdUah.toFixed(2) }}, € {{ fx.eurUah.toFixed(2) }}</li></ul></details>

    <div class="share">
      <button type="button" class="btn" @click="share">{{ copied ? 'Посилання скопійовано' : 'Поділитися розрахунком' }}</button>
      <Transition name="rise"><input v-if="shown" class="in mono-url" :value="shareUrl" readonly @focus="($event.target as HTMLInputElement).select()" /></Transition>
    </div>
  </div>
</template>
