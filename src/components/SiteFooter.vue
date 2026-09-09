<script setup lang="ts">
import site from '@config/site.json'
import { useI18n } from '../i18n'

const { t } = useI18n()
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-foot">
    <p class="disclaimer">{{ t('footer.disclaimer') }}</p>
    <details>
      <summary>{{ t('footer.legal') }}</summary>
      <div class="body">
        <p>{{ t('footer.data') }}</p>
        <p>{{ t('footer.privacy') }}</p>
        <p>{{ t('footer.liability') }}</p>
        <ul class="src">
          <li v-for="s in site.dataSources" :key="s.name">
            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.name }}</a>
            <span v-else>{{ s.name }}</span> — {{ s.note }}
          </li>
        </ul>
      </div>
    </details>
    <p class="rights">
      © {{ year }} {{ site.legal.owner }} · {{ t('footer.rights') }} · {{ site.legal.updated }}
      <template v-if="site.legal.contactEmail"> · <a :href="`mailto:${site.legal.contactEmail}`">{{ site.legal.contactEmail }}</a></template>
    </p>
  </footer>
</template>
