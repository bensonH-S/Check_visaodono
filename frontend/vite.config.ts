import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Em produção: https://grupoalvim.com.br/auditoria/ */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const appBase = (env.VITE_APP_BASE || '/auditoria').replace(/\/$/, '')
  const prodBase = env.VITE_APP_BASE === '' ? '/' : `${appBase}/`

  return {
  base: mode === 'production' ? prodBase : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      [`${appBase}/api`]: {
        target: 'http://localhost:5000',
        rewrite: (p) => p.replace(new RegExp(`^${appBase}`), ''),
      },
    },
  },
}})
