<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n, type Locale } from './i18n'
import * as calc from './state/calculator'
import { DESTINATIONS } from './state/calculator'
import { fromQuery, toQuery, type Snapshot } from './state/snapshot'
import { appPath } from './lib/url'
import { ORIGIN_COUNTRIES } from './lib/origins'
import type { Currency } from './types'

import TopBar from './components/layout/TopBar.vue'
import Hero from './components/layout/Hero.vue'
import StepSection from './components/layout/StepSection.vue'
import SiteFooter from './components/layout/SiteFooter.vue'
import ConsentBar from './components/layout/ConsentBar.vue'
import CountrySelect from './components/controls/CountrySelect.vue'
import HelpTip from './components/controls/HelpTip.vue'
import AmountField from './components/controls/AmountField.vue'
import VehicleStep from './components/vehicle/VehicleStep.vue'
import ResultView from './components/result/ResultView.vue'

const { t, locale, region, setLocale } = useI18n()
const { vehicle, originCountry, destination, price, currency, hasOriginProof, residenceTransfer, fx } = calc

const CURRENCIES: Currency[] = ['USD', 'EUR', 'UAH']
/** The routes people actually take come first; the rest are alphabetical in their own language. */
const PINNED_ORIGINS = ['US', 'DE', 'PL', 'LT', 'UA', 'JP', 'KR']
const PINNED_DESTINATIONS = ['UA', 'ES', 'PL', 'DE']

const priceText = ref('')
const resultStep = ref<{ root: HTMLElement | null } | null>(null)
/** True once a route is picked: the hero shrinks and the steps appear. */
const started = ref(false)
/** Held while the first state is restored, so nothing is written back over it. */
const restoring = ref(true)

function order<T extends { value: string; label: string }>(items: T[], pinned: string[]): T[] {
  const first = items.filter((i) => pinned.includes(i.value))
  const rest = items.filter((i) => !pinned.includes(i.value)).sort((a, b) => a.label.localeCompare(b.label, locale.value))
  return [...first, ...rest]
}

const origins = computed(() =>
  order(ORIGIN_COUNTRIES.map((c) => ({ value: c.code, label: region(c.code), flag: c.code.toLowerCase() })), PINNED_ORIGINS))

const destinations = computed(() =>
  order(DESTINATIONS.map((code) => ({
    value: code,
    label: region(code),
    flag: code.toLowerCase(),
    disabled: calc.origin.value === 'UA' && code === 'UA',
  })), PINNED_DESTINATIONS))

const snapshot = computed<Snapshot | null>(() =>
  calc.trip.value
    ? { vehicle: vehicle.value, trip: calc.trip.value, originCountry: originCountry.value, display: calc.display.value, locale: locale.value }
    : null)

const showOriginProof = computed(() => destination.value === 'UA' && calc.origin.value === 'EU')
const showResidenceRelief = computed(() => destination.value !== 'UA' && calc.origin.value !== 'EU')

/**
 * The address bar is the state. It is written out once the first screen is restored and
 * again whenever anything changes, so every value on screen is in the URL and copying it
 * is all sharing takes — no code to mint, nothing kept on a server.
 */
function writeUrl() {
  const state = snapshot.value
  if (!state) return
  const target = appPath(locale.value, toQuery(state))
  if (location.pathname + location.search !== target) history.replaceState(null, '', target)
}

watch(snapshot, () => { if (!restoring.value) writeUrl() }, { deep: true })

watch(calc.routeChosen, (chosen) => { if (chosen) setTimeout(() => (started.value = true), 250) })

watch(calc.result, async (now, before) => {
  if (now && !before) {
    await nextTick()
    resultStep.value?.root?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

async function changeLocale(next: Locale) {
  await setLocale(next)
  history.replaceState(null, '', appPath(next, location.search))
}

onMounted(async () => {
  calc.apply(fromQuery(new URLSearchParams(location.search), DESTINATIONS))
  priceText.value = price.value ? String(price.value) : ''
  started.value = calc.routeChosen.value

  await nextTick()
  restoring.value = false
  writeUrl()
  await calc.refreshRates()
})
</script>

<template>
  <div class="page">
    <TopBar :model-value="locale" :label="t('app.lang')" @update:model-value="changeLocale" />

    <Hero :compact="started">
      <CountrySelect v-model="originCountry" :options="origins" :placeholder="t('app.from')" />
      <span class="route-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 12"><path d="M0 6h22M17 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" /></svg>
      </span>
      <CountrySelect v-model="destination" :options="destinations" :placeholder="t('app.to')" />
    </Hero>

    <Transition name="rise">
      <StepSection v-if="started && calc.routeChosen.value" :title="t('step.car')">
        <VehicleStep v-model="vehicle" :destination="destination!" :origin="calc.origin.value!" />
      </StepSection>
    </Transition>

    <Transition name="rise">
      <StepSection v-if="started && calc.vehicleReady.value" :title="t('step.price')">
        <div class="grid grid-3">
          <label class="field">
            <span class="field-label">{{ t('price.label') }} <HelpTip :text="t('price.help')" /></span>
            <AmountField v-model:amount="price" v-model:currency="currency" v-model:text="priceText" :currencies="CURRENCIES" placeholder="10000" />
          </label>

          <label v-if="showOriginProof" class="checkbox">
            <input v-model="hasOriginProof" type="checkbox" />
            <span>{{ t('price.originProof') }}</span>
            <HelpTip :text="t('price.help.originProof')" :source="{ title: 'zakon.rada.gov.ua', url: 'https://zakon.rada.gov.ua/laws/show/2697-20' }" />
          </label>

          <label v-if="showResidenceRelief" class="checkbox">
            <input v-model="residenceTransfer" type="checkbox" />
            <span>{{ t('price.residence') }}</span>
            <HelpTip :text="t('price.help.residence')" :source="{ title: 'Regulation (EC) 1186/2009', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1186' }" />
          </label>
        </div>
      </StepSection>
    </Transition>

    <Transition name="rise">
      <StepSection v-if="calc.result.value && calc.trip.value" ref="resultStep" :title="t('step.result')" plain>
        <ResultView v-model:currency="calc.display.value" :estimate="calc.result.value" :vehicle="vehicle" :trip="calc.trip.value" :fx="fx" />
      </StepSection>
    </Transition>

    <p v-if="!started" class="page-note">{{ t('app.foot') }}</p>
    <SiteFooter />
    <ConsentBar />
  </div>
</template>
