import { createApp } from 'vue'
import 'flag-icons/css/flag-icons.min.css'
import './style.css'
import App from './App.vue'
import { detectLocale, setLocale } from './i18n'
import { geoCountry } from './lib/share'
import { initAnalytics } from './lib/analytics'

detectLocale(geoCountry).then(async (l) => {
  await setLocale(l)
  createApp(App).mount('#app')
  initAnalytics()
})
