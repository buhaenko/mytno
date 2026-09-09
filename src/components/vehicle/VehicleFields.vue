<script setup lang="ts">
import { computed } from 'vue'
import type { Destination, Fuel, Market, Vehicle } from '../../types'
import { useI18n } from '../../i18n'
import HelpTip from '../controls/HelpTip.vue'
import ChoiceChips from '../controls/ChoiceChips.vue'

/** Whatever the lookup could not tell us, or got wrong, is editable here. */
const vehicle = defineModel<Vehicle>({ required: true })
const props = defineProps<{ destination: Destination }>()
const { t } = useI18n()

const FUELS: Fuel[] = ['petrol', 'diesel', 'hybrid', 'phev', 'electric', 'lpg']
const MARKETS: Market[] = ['US', 'EU', 'JP', 'KR', 'OTHER']

const electrified = computed(() => vehicle.value.fuel === 'electric' || vehicle.value.fuel === 'phev')
/** CO₂ sets the registration tax in Spain and Austria; the new price only in Spain. */
const needsCo2 = computed(() => props.destination === 'ES' || props.destination === 'AT')
const needsListPrice = computed(() => props.destination === 'ES')
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
      <input v-model.number="vehicle.engineCc" type="number" class="input" placeholder="1984" />
    </label>

    <label v-if="electrified" class="field">
      <span class="field-label">{{ t('car.kwh') }} <HelpTip :text="t('car.help.kwh')" /></span>
      <input v-model.number="vehicle.batteryKwh" type="number" class="input" placeholder="75" />
    </label>

    <label v-if="needsCo2" class="field">
      <span class="field-label">
        {{ t('car.co2') }}
        <HelpTip :text="t('car.help.co2')" :source="{ title: 'Ley 38/1992, art. 70 (boe.es)', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741' }" />
      </span>
      <input v-model.number="vehicle.co2Wltp" type="number" class="input" placeholder="168" />
    </label>

    <label v-if="needsListPrice" class="field">
      <span class="field-label">
        {{ t('car.listPrice') }}
        <HelpTip :text="t('car.help.listPrice')" :source="{ title: 'AEAT — Vehículos', url: 'https://sede.agenciatributaria.gob.es/Sede/vehiculos-embarcaciones.html' }" />
      </span>
      <input v-model.number="vehicle.listPriceEur" type="number" class="input" placeholder="47150" />
    </label>

    <div class="field field-wide">
      <span class="field-label">{{ t('car.market') }} <HelpTip :text="t('car.help.market')" /></span>
      <ChoiceChips v-model="vehicle.market" :options="markets" />
    </div>
  </div>
</template>
