import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    // the FastAPI backend runs on :8000 during development
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        /* Long-lived vendor chunks cache well; the PDF/Word libraries load only on export. */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (/node_modules\/(@headlessui|@floating-ui|@react-aria|react-aria|@tanstack|tabbable|@swc)\//.test(id)) return 'ui'
          if (/node_modules\/react-icons\//.test(id)) return 'icons'
        },
      },
    },
  },
})
