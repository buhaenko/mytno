import { createApp } from 'vue'
import 'flag-icons/css/flag-icons.min.css'
import './styles/index.css'
import App from './App.vue'
import { detectLocale, setLocale } from './i18n'
import { initAnalytics } from './lib/analytics'

/** Pick the language before the first paint, so nothing flashes in English. */
setLocale(detectLocale()).then(() => {
  createApp(App).mount('#app')
  // The ring goes out the moment there is something real to look at.
  const root = document.getElementById('app')
  root?.classList.remove('pending')
  root?.classList.add('ready')
  initAnalytics()
})
