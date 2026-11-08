import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /api requests are proxied to the Spring Boot backend on port 8090.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
})
