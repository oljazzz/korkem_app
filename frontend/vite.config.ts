import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev режимде /api сұраныстары Spring Boot бэкендке (8090) жіберіледі.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
})
