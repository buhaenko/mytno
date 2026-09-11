<script setup lang="ts">
import site from '@config/site.json'

/**
 * One line, and only what belongs at the bottom of a page: whose site it is and where to
 * write. The legal notice and the sources are pages of their own in the header now — they
 * were a tooltip and a link crowded into a single line, which is where things go to be
 * unread.
 */
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <p class="footer-line">
      <span>© {{ year }} <strong>{{ site.brand }}</strong></span>
      <template v-if="site.legal.contactEmail">
        <span class="footer-dot">·</span>
        <a :href="`mailto:${site.legal.contactEmail}`">{{ site.legal.contactEmail }}</a>
      </template>
    </p>
  </footer>
</template>
