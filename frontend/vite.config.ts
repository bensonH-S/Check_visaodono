import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const APP_BASE = '/auditoria'
const DEV_API_PORT = 5000

function auditoriaBaseRedirect() {
  return {
    name: 'auditoria-base-redirect',
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] ?? ''
        const isAsset =
          raw.includes('.') ||
          raw.startsWith('/@') ||
          raw.startsWith('/node_modules') ||
          raw.startsWith('/src')

        if (raw === '/') {
          res.writeHead(302, { Location: `${APP_BASE}/` })
          res.end()
          return
        }

        if (!raw.startsWith(APP_BASE) && !isAsset) {
          const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
          res.writeHead(302, { Location: `${APP_BASE}${raw}${qs}` })
          res.end()
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  base: `${APP_BASE}/`,
  plugins: [
    react(),
    tailwindcss(),
    auditoriaBaseRedirect(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Logo_Icon.png', 'logo-grupo-alvim.png'],
      manifest: {
        name: 'Vision Check — Grupo Alvim',
        short_name: 'Vision Check',
        description: 'Checklist, chamados e auditoria — Grupo Alvim',
        theme_color: '#1B2A6B',
        background_color: '#f5f5f3',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'pt-BR',
        start_url: 'login/mobile',
        scope: './',
        icons: [
          {
            src: 'Logo_Icon.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'Logo_Icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'Logo_Icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/api\//],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    open: `${APP_BASE}/`,
    proxy: {
      [`${APP_BASE}/api`]: {
        target: `http://localhost:${DEV_API_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
