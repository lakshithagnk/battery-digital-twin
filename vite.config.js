import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // ⚠️  Change 'battery-digital-twin' to your actual GitHub repo name
  base: '/battery-digital-twin/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
