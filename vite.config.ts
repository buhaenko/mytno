import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// On GitHub Pages the site lives under /vin-import-calc/ — the base path comes from the workflow.
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE ?? '/',
  // The tax rules live in one shared folder: the API serves them, the app bundles them.
  resolve: { alias: { '@config': fileURLToPath(new URL('./config', import.meta.url)) } },
})
