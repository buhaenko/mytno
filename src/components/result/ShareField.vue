<script setup lang="ts">
import { useI18n } from '../../i18n'

/** The link is ready before anyone asks for it; one click copies it. */
defineProps<{ url: string; copied: boolean }>()
const emit = defineEmits<{ copy: [] }>()
const { t } = useI18n()
</script>

<template>
  <button type="button" class="share" :class="{ done: copied }" @click="emit('copy')">
    <span class="share-label">
      <span class="dot" :class="{ pending: !url }"></span>
      {{ copied ? t('result.copied') : t('result.share') }}
    </span>
    <span class="share-url">{{ url || '…' }}</span>
  </button>
</template>
