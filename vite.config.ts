import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Enable SPA fallback so /admin and other deep routes are served by index.html
  appType: 'spa',
})
