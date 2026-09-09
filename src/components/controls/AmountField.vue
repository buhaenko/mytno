<script setup lang="ts">
import type { Currency } from '../../types'

/** A price and its currency. Typing accepts 20000, 20 000, 20,000 or 20.000 alike. */
const amount = defineModel<number>('amount', { required: true })
const currency = defineModel<Currency>('currency', { required: true })
defineProps<{ currencies: readonly Currency[]; placeholder?: string }>()

const text = defineModel<string>('text', { required: true })

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  text.value = raw
  const digits = raw.replace(/\D/g, '')
  amount.value = digits ? Number(digits) : 0
}
</script>

<template>
  <div class="amount">
    <input :value="text" type="text" inputmode="numeric" autocomplete="off" class="input" :placeholder="placeholder" @input="onInput" />
    <select v-model="currency" class="input">
      <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
    </select>
  </div>
</template>
