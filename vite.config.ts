import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// On GitHub Pages the site lives under /mytno/ — the base path comes from the workflow.
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE ?? '/',
  // The tax rules live in one folder of plain JSON, bundled straight into the app.
  resolve: { alias: { '@config': fileURLToPath(new URL('./config', import.meta.url)) } },
})
