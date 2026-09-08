import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// On GitHub Pages the site lives under /vin-import-calc/ — the base path comes from the workflow.
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE ?? '/',
})
