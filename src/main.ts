import { createApp } from 'vue'
import 'flag-icons/css/flag-icons.min.css'
import './style.css'
import App from './App.vue'
import { detectLocale, setLocale } from './i18n'
import { geoCountry } from './lib/share'

detectLocale(geoCountry).then(async (l) => {
  await setLocale(l, false)
  createApp(App).mount('#app')
})
