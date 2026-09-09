<script setup lang="ts">
import { computed } from 'vue'
import site from '@config/site.json'
import { useI18n } from '../../i18n'

/** What the numbers are, what they are not, and where every one of them came from. */
const { t } = useI18n()
const year = new Date().getFullYear()

/** The disclaimer names the site; the name is set in type, so it is a slot, not a word. */
const disclaimer = computed(() => t('footer.disclaimer').split('{brand}'))
</script>

<template>
  <footer class="footer">
    <p class="footer-lead">{{ disclaimer[0] }}<strong>{{ site.brand }}</strong>{{ disclaimer[1] }}</p>

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

    <p v-if="site.legal.contactEmail" class="footer-contact">
      {{ t('footer.contact') }}
      <a :href="`mailto:${site.legal.contactEmail}`">{{ site.legal.contactEmail }}</a>
    </p>

    <p class="footer-rights">
      © {{ year }} <strong>{{ site.legal.owner }}</strong> · {{ t('footer.rights') }} · {{ site.legal.updated }}
    </p>
  </footer>
</template>
