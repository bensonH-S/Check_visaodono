import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const APP_BASE = '/auditoria'
const DEV_API_PORT = 5000

export default defineConfig({
  base: `${APP_BASE}/`,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      [`${APP_BASE}/api`]: {
        target: `http://localhost:${DEV_API_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
