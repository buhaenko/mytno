import { createApp } from 'vue'
import 'flag-icons/css/flag-icons.min.css'
import './styles/index.css'
import App from './App.vue'
import { detectLocale, setLocale } from './i18n'
import { geoCountry } from './lib/shareLink'
import { initAnalytics } from './lib/analytics'

/** Pick the language before the first paint, so nothing flashes in English. */
detectLocale(geoCountry)
  .then(setLocale)
  .then(() => {
    createApp(App).mount('#app')
    initAnalytics()
  })
