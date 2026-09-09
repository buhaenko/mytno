<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { countryBrief } from '../../lib/pages'
import { DESTINATION_INFO, sourcesFor } from '../../lib/countrySources'

/** The rates that apply in one country, and the two questions people ask about them. */
const props = defineProps<{ code: string }>()
const { t, region } = useI18n()

const brief = computed(() => {
  const info = DESTINATION_INFO[props.code]!
  return countryBrief(region(props.code), info, sourcesFor(props.code, info), t)
})
</script>

<template>
  <section class="brief">
    <p class="step-head"><span class="step-mark"></span><span>{{ t('result.taxes') }}</span><span class="step-rule"></span></p>

    <dl class="brief-rows">
      <template v-for="row in brief.rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>
          {{ row.note }}
          <a :href="row.source.url" target="_blank" rel="noopener noreferrer">{{ row.source.title }}</a>
        </dd>
      </template>
    </dl>

    <div class="brief-faq">
      <details v-for="item in brief.faq" :key="item.q">
        <summary>{{ item.q }}</summary>
        <p class="disclosure">{{ item.a }}</p>
      </details>
    </div>
  </section>
</template>
