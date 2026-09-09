<script setup lang="ts">
import { ref } from 'vue'
import { consentAnswered, needsConsent, setConsent } from '../../lib/analytics'
import { useI18n } from '../../i18n'

/** Only ever seen when Google Analytics is configured; cookieless analytics needs no bar. */
const { t } = useI18n()
const open = ref(needsConsent && !consentAnswered())

function answer(accepted: boolean) {
  setConsent(accepted)
  open.value = false
}
</script>

<template>
  <Transition name="rise">
    <div v-if="open" class="consent" role="dialog" aria-live="polite">
      <span>{{ t('consent.text') }}</span>
      <span class="consent-actions">
        <button type="button" class="chip" @click="answer(false)">{{ t('consent.decline') }}</button>
        <button type="button" class="chip on" @click="answer(true)">{{ t('consent.accept') }}</button>
      </span>
    </div>
  </Transition>
</template>
