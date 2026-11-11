import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// In dev, /api requests are proxied to the Spring Boot backend on port 8090.
export default defineConfig({
  plugins: [react()],
  // App version from package.json, shown at the bottom of the home page
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
})
