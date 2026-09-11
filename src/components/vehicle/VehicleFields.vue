<script setup lang="ts">
import { computed } from 'vue'
import type { Destination, Fuel, Market, Vehicle } from '../../types'
import { useI18n } from '../../i18n'
import HelpTip from '../controls/HelpTip.vue'
import { price } from '../../state/calculator'
import ChoiceChips from '../controls/ChoiceChips.vue'

/** Whatever the lookup could not tell us, or got wrong, is editable here. */
const vehicle = defineModel<Vehicle>({ required: true })
const props = defineProps<{ destination: Destination }>()
const { t, locale } = useI18n()

const FUELS: Fuel[] = ['petrol', 'diesel', 'hybrid', 'phev', 'electric', 'lpg']
const MARKETS: Market[] = ['US', 'EU', 'JP', 'KR', 'OTHER']

const electrified = computed(() => vehicle.value.fuel === 'electric' || vehicle.value.fuel === 'phev')
/** CO₂ sets the registration tax in six countries; the new price only in Spain, the power only in Slovakia. */
const CO2_COUNTRIES: Destination[] = ['ES', 'AT', 'NL', 'PT', 'LT', 'SI', 'FR', 'EE', 'BE', 'DK', 'IE', 'HR', 'MT', 'FI', 'GR']
const needsCo2 = computed(() => CO2_COUNTRIES.includes(props.destination))
const needsListPrice = computed(() => props.destination === 'ES')
const POWER_COUNTRIES: Destination[] = ['SK', 'IT', 'SI', 'HU', 'BE']
const needsMass = computed(() => props.destination === 'EE' || props.destination === 'BE')
/** The mass in running order, field G: Norway's whole tax, the French weight malus, the Swiss CO₂ target. */
const KERB_COUNTRIES: Destination[] = ['NO', 'FR', 'CH']
const needsKerb = computed(() => KERB_COUNTRIES.includes(props.destination))
const needsLength = computed(() => props.destination === 'MT')
/** Five tables are monthly, so in those five the month of first registration is worth asking for. */
const MONTH_COUNTRIES: Destination[] = ['NL', 'FR', 'HU', 'BE', 'HR']
const needsMonth = computed(() => MONTH_COUNTRIES.includes(props.destination))
const months = computed(() => Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(2026, i, 1)),
})))
const needsPower = computed(() => POWER_COUNTRIES.includes(props.destination))
/** A car cannot have cost less when new than it did second-hand: that is the purchase price in the wrong field. */
const listPriceTooLow = computed(() =>
  !!vehicle.value.listPriceEur && price.value > 0 && vehicle.value.listPriceEur <= price.value)
const spainCo2Source = { title: 'Ley 38/1992, art. 70 (boe.es)', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741' }
const displacementHelp = computed(() =>
  props.destination === 'UA' ? 'car.help.ccUa' : props.destination === 'PL' ? 'car.help.ccPl' : 'car.help.ccOther')

const markets = computed(() => MARKETS.map((value) => ({ value, label: t(`car.market.${value}`) })))
const fuels = computed(() => FUELS.map((value) => ({ value, label: t(`car.fuel.${value}`) })))
</script>

<template>
  <div class="grid grid-4">
    <label class="field">
      <span class="field-label">{{ t('car.year') }}</span>
      <input v-model.number="vehicle.year" type="number" class="input" min="1980" :max="new Date().getFullYear() + 1" />
    </label>

    <label class="field">
      <span class="field-label">{{ t('car.fuel') }}</span>
      <select v-model="vehicle.fuel" class="input">
        <option v-for="f in fuels" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
    </label>

    <label v-if="vehicle.fuel !== 'electric'" class="field">
      <span class="field-label">{{ t('car.cc') }} <HelpTip :text="t(displacementHelp)" /></span>
      <input v-model.number="vehicle.engineCc" type="number" class="input" :placeholder="t('car.eg', { value: 1984 })" />
    </label>

    <label v-if="electrified" class="field">
      <span class="field-label">{{ t('car.kwh') }} <HelpTip :text="t('car.help.kwh')" /></span>
      <input v-model.number="vehicle.batteryKwh" type="number" class="input" :placeholder="t('car.eg', { value: 75 })" />
    </label>

    <label v-if="needsMonth" class="field">
      <span class="field-label">{{ t('car.regMonth') }} <HelpTip :text="t('car.help.regMonth')" /></span>
      <select v-model.number="vehicle.regMonth" class="input">
        <option :value="undefined">{{ t('car.regMonth.unknown') }}</option>
        <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </label>

    <label v-if="needsCo2" class="field">
      <span class="field-label">
        {{ t('car.co2') }}
        <HelpTip :text="t('car.help.co2')" :source="destination === 'ES' ? spainCo2Source : undefined" />
      </span>
      <input
        v-model.number="vehicle.co2Wltp" type="number" class="input" :placeholder="t('car.eg', { value: 168 })"
        @input="vehicle.co2Source = 'certified'"
      />
      <span v-if="vehicle.co2Source === 'epa'" class="field-note">{{ t('car.co2FromEpa') }}</span>
    </label>

    <label v-if="needsPower" class="field">
      <span class="field-label">{{ t('car.power') }} <HelpTip :text="t('car.help.power')" /></span>
      <input v-model.number="vehicle.powerHp" type="number" class="input" :placeholder="t('car.eg', { value: 252 })" />
    </label>

    <label v-if="needsMass" class="field">
      <span class="field-label">{{ t('car.mass') }} <HelpTip :text="t('car.help.mass')" /></span>
      <input v-model.number="vehicle.grossMassKg" type="number" class="input" :placeholder="t('car.eg', { value: 2000 })" />
    </label>

    <label v-if="needsKerb" class="field">
      <span class="field-label">{{ t('car.kerbMass') }} <HelpTip :text="t('car.help.kerbMass')" /></span>
      <input v-model.number="vehicle.kerbMassKg" type="number" class="input" :placeholder="t('car.eg', { value: 1600 })" />
    </label>

    <label v-if="needsLength" class="field">
      <span class="field-label">{{ t('car.length') }} <HelpTip :text="t('car.help.length')" /></span>
      <input v-model.number="vehicle.lengthMm" type="number" class="input" :placeholder="t('car.eg', { value: 4726 })" />
    </label>

    <label v-if="needsListPrice" class="field">
      <span class="field-label">
        {{ t('car.listPrice') }}
        <HelpTip :text="t('car.help.listPrice')" :source="{ title: 'AEAT — Vehículos', url: 'https://sede.agenciatributaria.gob.es/Sede/vehiculos-embarcaciones.html' }" />
      </span>
      <input v-model.number="vehicle.listPriceEur" type="number" class="input" :placeholder="t('car.eg', { value: 47150 })" />
      <span v-if="!vehicle.listPriceEur" class="field-note">{{ t('car.listPriceEmpty') }}</span>
      <span v-if="listPriceTooLow" class="field-warn">{{ t('car.listPriceTooLow') }}</span>
    </label>

    <div class="field field-wide">
      <span class="field-label">{{ t('car.market') }} <HelpTip :text="t('car.help.market')" /></span>
      <ChoiceChips v-model="vehicle.market" :options="markets" />
    </div>
  </div>
</template>
