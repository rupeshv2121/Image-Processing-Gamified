import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During development (npm run dev) API calls are forwarded to the
// MATLAB bridge server on port 8765.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8765',
      '/reports': 'http://localhost:8765',
    },
  },
})
