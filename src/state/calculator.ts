import { computed, reactive, ref, watch } from 'vue'
import type { Currency, Destination, Estimate, FxRates, Origin, Trip, Vehicle } from '../types'
import countries from '@config/countries.json'
import fxFallback from '@config/fx.fallback.json'
import { estimate } from '../lib/calc'
import { loadFx } from '../lib/fx'
import { ORIGIN_GROUP } from '../lib/origins'
import { blankVehicle, type Snapshot } from './snapshot'

export const DESTINATIONS = Object.keys(countries.destinations) as Destination[]

/** The whole app runs on these seven values; everything else is derived from them. */
export const vehicle = ref<Vehicle>(blankVehicle())
export const originCountry = ref<string | null>(null)
export const destination = ref<Destination | null>(null)
export const price = ref(0)
export const currency = ref<Currency>('USD')
export const hasOriginProof = ref(true)
export const residenceTransfer = ref(false)
export const fx = reactive<FxRates>({ ...fxFallback, source: 'fallback' })

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

/** Where the car is bought decides the currency people will type in. */
watch(originCountry, (code) => {
  currency.value = code === 'US' || code === 'CA' ? 'USD' : code === 'UA' ? 'UAH' : 'EUR'
  if (origin.value === 'UA' && destination.value === 'UA') destination.value = null
})

export function apply(state: Partial<Snapshot>) {
  if (state.vehicle) vehicle.value = state.vehicle
  if (state.originCountry !== undefined) originCountry.value = state.originCountry
  if (!state.trip) return
  destination.value = state.trip.destination
  price.value = state.trip.price
  currency.value = state.trip.currency
  hasOriginProof.value = state.trip.hasOriginProof
  residenceTransfer.value = state.trip.residenceTransfer
}

export const refreshRates = async () => Object.assign(fx, await loadFx())
