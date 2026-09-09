import { computed, reactive, ref, watch } from 'vue'
import type { Currency, Destination, Estimate, FxRates, Origin, Trip, Vehicle } from '../types'
import countries from '@config/countries.json'
import { estimate } from '../lib/calc'
import { fallbackRates, loadFx } from '../lib/fx'
import { currencyOf, ORIGIN_GROUP } from '../lib/origins'
import { blankVehicle, type Restored } from './snapshot'

export const DESTINATIONS = Object.keys(countries.destinations) as Destination[]

/** The whole app runs on these seven values; everything else is derived from them. */
export const vehicle = ref<Vehicle>(blankVehicle())
export const originCountry = ref<string | null>(null)
export const destination = ref<Destination | null>(null)
export const price = ref(0)
/** Everything is reckoned in euro, so that is what both the price and the total start in. */
export const currency = ref<Currency>('EUR')
export const display = ref<Currency>('EUR')
export const hasOriginProof = ref(true)
export const residenceTransfer = ref(false)
export const fx = reactive<FxRates>(fallbackRates())

/** Customs rules follow a group of countries, not a single one. */
export const origin = computed<Origin | null>(() => (originCountry.value ? ORIGIN_GROUP[originCountry.value] ?? 'OTHER' : null))
export const routeChosen = computed(() => !!origin.value && !!destination.value)

export const vehicleReady = computed(() => {
  const v = vehicle.value
  if (!v.make || !v.model) return false
  return v.fuel === 'electric' ? !!v.batteryKwh : !!v.engineCc
})

export const trip = computed<Trip | null>(() =>
  origin.value && destination.value
    ? {
        origin: origin.value,
        destination: destination.value,
        price: price.value,
        currency: currency.value,
        hasOriginProof: hasOriginProof.value,
        residenceTransfer: residenceTransfer.value,
      }
    : null)

export const result = computed<Estimate | null>(() =>
  trip.value && vehicleReady.value && price.value > 0 ? estimate(vehicle.value, trip.value, fx) : null)

/**
 * The country decides the currency: a car in Poland is priced in zloty, one in
 * Norway in kroner. The price follows where it is bought, the total follows where
 * it is registered — synchronously, so a currency named in the URL still wins.
 */
watch(originCountry, (code) => {
  if (origin.value === 'UA' && destination.value === 'UA') destination.value = null
  currency.value = currencyOf(code)
}, { flush: 'sync' })

watch(destination, (code) => { display.value = currencyOf(code) }, { flush: 'sync' })

/** Everything on screen comes from the query string, and nothing that is absent is guessed. */
export function apply(state: Restored) {
  if (state.vehicle) vehicle.value = state.vehicle
  originCountry.value = state.originCountry
  destination.value = state.destination
  price.value = state.price
  currency.value = state.currency
  display.value = state.display
  hasOriginProof.value = state.hasOriginProof
  residenceTransfer.value = state.residenceTransfer
}

export const refreshRates = async () => Object.assign(fx, await loadFx())
