import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const appBase = (env.APP_BASE_PATH || '/auditoria').replace(/\/$/, '')
  const base = `${appBase}/`
  const apiPort = env.PORT || '5000'

  return {
    envDir: '..',
    base,
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        [`${appBase}/api`]: {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
