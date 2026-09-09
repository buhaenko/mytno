import { ref, watch } from 'vue'
import type { Locale } from '../i18n'
import { createShareUrl } from '../lib/shareLink'
import type { Snapshot } from './snapshot'
import { toWire } from './snapshot'

/**
 * The share link follows the calculation: it is regenerated shortly after the
 * numbers settle, and clicking the field copies it. Nothing touches the address bar.
 */
export function useShareLink(snapshot: () => Snapshot | null, locale: () => Locale, delayMs = 500) {
  const url = ref('')
  const copied = ref('')
  let timer = 0
  let latest = 0

  function refresh(delay = delayMs) {
    url.value = ''
    clearTimeout(timer)
    const state = snapshot()
    if (!state) return
    const request = ++latest
    timer = window.setTimeout(async () => {
      const link = await createShareUrl(toWire(state), locale())
      if (request === latest) url.value = link
    }, delay)
  }

  watch(snapshot, () => refresh(), { deep: true })

  async function copy() {
    if (!url.value) return
    try {
      await navigator.clipboard.writeText(url.value)
      copied.value = url.value
      setTimeout(() => (copied.value = ''), 1500)
    } catch { /* clipboard blocked; the text is selectable anyway */ }
  }

  return { url, copied, copy, refresh }
}
