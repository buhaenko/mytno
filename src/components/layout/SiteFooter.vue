<script setup lang="ts">
import site from '@config/site.json'
import countries from '@config/countries.json'
import ukraine from '@config/rules.ukraine.json'
import { useI18n } from '../../i18n'
import HelpTip from '../controls/HelpTip.vue'

/**
 * One line. What the tool is, what the numbers are made of and where to write —
 * all of it behind a single “?”, the way the rest of the app explains itself.
 */
const { t } = useI18n()
const year = new Date().getFullYear()

/** Three of the sources behind the numbers, as examples of what “official” means here. */
const examples = [countries.euDutySource, countries.vatSource, ukraine.refs.excise]
</script>

<template>
  <footer class="footer">
    <p class="footer-line">
      <span>© {{ year }} <strong>{{ site.brand }}</strong></span>
      <span class="footer-dot">·</span>
      <span class="footer-legal">
        {{ t('footer.legal') }}
        <HelpTip
          :text="t('footer.disclaimer').replace('{brand}', site.brand)"
          :notes="[t('footer.help.rights'), t('footer.data'), t('footer.privacy'), t('footer.liability')]"
          :source="examples"
        />
      </span>
      <template v-if="site.legal.contactEmail">
        <span class="footer-dot">·</span>
        <a :href="`mailto:${site.legal.contactEmail}`">{{ site.legal.contactEmail }}</a>
      </template>
    </p>
  </footer>
</template>
