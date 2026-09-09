<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isVin, normalizeVin } from '../../lib/vehicle/vin'

/** Seventeen characters. It looks them up the moment they are all there. */
const props = defineProps<{ vin?: string; busy: boolean; placeholder: string }>()
const emit = defineEmits<{ lookup: [vin: string] }>()

const typed = ref(props.vin ?? '')
const vin = computed(() => normalizeVin(typed.value))

watch(vin, (value) => { if (isVin(value) && value !== props.vin) emit('lookup', value) })
</script>

<template>
  <div class="vin">
    <input v-model="typed" class="input input-vin" :placeholder="placeholder" maxlength="20" autocomplete="off" spellcheck="false" @keyup.enter="isVin(vin) && emit('lookup', vin)" />
    <span v-if="busy" class="spinner"></span>
  </div>
</template>
