<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalcResult, Category, Currency, FxRates, RouteInput, Vehicle } from '../types'
import { fmt } from '../lib/money'
import { toEur } from '../lib/fx'
import rulesUa from '../data/rules.ukraine.json'
import rulesEs from '../data/rules.spain.json'
import Chips from './Chips.vue'

const props = defineProps<{ result: CalcResult; vehicle: Vehicle; route: RouteInput; fx: FxRates }>()
const cur = ref<Currency>(props.route.destination === 'UA' ? 'USD' : 'EUR')
const curOptions: { value: Currency; label: string }[] = [{ value: 'EUR', label: '€' }, { value: 'USD', label: '$' }, { value: 'UAH', label: '₴' }]
const details = ref(false)
const copied = ref(false)

const CATS: { key: Category; label: string }[] = [
  { key: 'tax', label: 'Податки' }, { key: 'logistics', label: 'Логістика' }, { key: 'compliance', label: 'Сертифікація та переобладнання' },
  { key: 'fees', label: 'Оформлення' }, { key: 'repair', label: 'Ремонт' },
]
const grouped = computed(() => CATS.map((c) => ({ ...c, items: props.result.items.filter((i) => i.category === c.key) })).filter((g) => g.items.length))
const priceEur = computed(() => toEur(props.route.purchasePrice, props.route.purchaseCurrency, props.fx))
const grand = computed(() => priceEur.value + props.result.total.likely)
const overheadPct = computed(() => (priceEur.value > 0 ? Math.round((props.result.total.likely / priceEur.value) * 100) : 0))
const sources = computed(() => (props.route.destination === 'UA' ? rulesUa.sources : rulesEs.sources))
const money = (v: number) => fmt(v, cur.value, props.fx)
const reqLabel = { always: 'обов\'язково', likely: 'найімовірніше', sometimes: 'іноді' }
const nuanceCost = (c: [number, number]) => (c[0] === 0 && c[1] === 0 ? '—' : `${money(c[0])} – ${money(c[1])}`)
async function copyLink() {
  try { await navigator.clipboard.writeText(location.href); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch { /* noop */ }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2 style="margin:0">Поверх ціни авто</h2>
      <Chips v-model="cur" :options="curOptions" />
    </div>
    <div class="total">
      <div class="n">{{ money(result.total.likely) }}</div>
      <div class="r">{{ money(result.total.min) }} – {{ money(result.total.max) }} · +{{ overheadPct }}% до ціни</div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="k">Авто на номерах разом</div><div class="v">{{ money(grand) }}</div></div>
      <div class="kpi"><div class="k">З них податки</div><div class="v">{{ money(result.taxesTotal.likely) }}</div></div>
      <div class="kpi"><div class="k">Митна вартість</div><div class="v">{{ money(result.customsValue) }}</div></div>
    </div>

    <div v-if="result.warnings.length" style="margin-top:16px">
      <p v-for="(w, i) in result.warnings" :key="i" class="note warn">{{ w }}</p>
    </div>

    <table class="lines" style="margin-top:8px">
      <tbody>
        <template v-for="g in grouped" :key="g.key">
          <tr class="cat"><td colspan="3">{{ g.label }}</td></tr>
          <tr v-for="it in g.items" :key="it.key">
            <td>
              {{ it.label }}
              <div v-if="details && it.note" class="sub">{{ it.note }}</div>
              <div v-if="details && it.formula" class="formula">{{ it.formula }}</div>
            </td>
            <td class="n dim">{{ Math.abs(it.range.max - it.range.min) < 1 ? '' : `${money(it.range.min)} – ${money(it.range.max)}` }}</td>
            <td class="n">{{ money(it.range.likely) }}</td>
          </tr>
        </template>
        <tr class="sum"><td>Разом поверх ціни</td><td class="n dim">{{ money(result.total.min) }} – {{ money(result.total.max) }}</td><td class="n">{{ money(result.total.likely) }}</td></tr>
        <tr class="sum" style="font-weight:500"><td>+ авто {{ money(priceEur) }}</td><td></td><td class="n">{{ money(grand) }}</td></tr>
      </tbody>
    </table>
    <p class="small" style="margin-top:10px"><button class="link" @click="details = !details">{{ details ? 'Сховати пояснення' : 'Пояснення та формули' }}</button> · <button class="link" @click="copyLink">{{ copied ? 'Скопійовано' : 'Скопіювати посилання' }}</button></p>

    <div v-if="result.nuances.length" style="margin-top:28px">
      <h2>Нюанси для цього авто</h2>
      <div v-for="n in result.nuances" :key="n.id" class="nu">
        <div><span class="req" :class="n.required">{{ reqLabel[n.required] }}</span>{{ n.title }}</div>
        <div class="c">{{ nuanceCost(n.cost[vehicle.brandTier]) }}</div>
        <div class="w">{{ n.why }}<template v-if="n.howTo"> {{ n.howTo }}</template></div>
      </div>
    </div>

    <div style="margin-top:28px">
      <h2>Порядок дій</h2>
      <ol class="steps"><li v-for="(c, i) in result.checklist" :key="i">{{ c }}</li></ol>
    </div>

    <p class="foot">
      Курс НБУ {{ fx.date }}: $ {{ fx.usdUah.toFixed(2) }} · € {{ fx.eurUah.toFixed(2) }}{{ fx.source === 'fallback' ? ' (резервний)' : '' }}.
      Ставки: {{ sources.join('; ') }}. Ринкові витрати (доставка, брокер, омологація, запчастини) — типові ціни 2026; остаточну суму визначає митниця.
    </p>
  </div>
</template>
