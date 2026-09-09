<script setup lang="ts">
import site from '@config/site.json'
import { useI18n } from '../../i18n'

/** What the numbers are, what they are not, and where every one of them came from. */
const { t } = useI18n()
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <p class="footer-lead">{{ t('footer.disclaimer') }}</p>

    <details>
      <summary>{{ t('footer.legal') }}</summary>
      <div class="disclosure">
        <p>{{ t('footer.data') }}</p>
        <p>{{ t('footer.privacy') }}</p>
        <p>{{ t('footer.liability') }}</p>
        <ul>
          <li v-for="source in site.dataSources" :key="source.name">
            <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a>
            <span v-else>{{ source.name }}</span> — {{ source.note }}
          </li>
        </ul>
      </div>
    </details>

    <p class="footer-rights">
      © {{ year }} {{ site.legal.owner }} · {{ t('footer.rights') }} · {{ site.legal.updated }}
      <template v-if="site.legal.contactEmail"> · <a :href="`mailto:${site.legal.contactEmail}`">{{ site.legal.contactEmail }}</a></template>
    </p>
  </footer>
</template>
