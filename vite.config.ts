import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// На GitHub Pages сайт живе під /vin-import-calc/ — базовий шлях передається з workflow.
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE ?? '/',
})
