import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const APP_BASE = '/auditoria'
const DEV_API_PORT = 5000
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function readBuildVersion() {
  const versionFile = path.join(ROOT, 'VERSION')
  if (!fs.existsSync(versionFile)) return 'dev'
  const raw = fs.readFileSync(versionFile, 'utf8').trim()
  const match = raw.match(/^(v\d+(?:\.\d+)*)/i)
  return match ? match[1] : raw || 'dev'
}

function readBuildId() {
  const appVersionFile = path.join(ROOT, 'frontend/public/app-version.json')
  if (fs.existsSync(appVersionFile)) {
    try {
      const { buildId } = JSON.parse(fs.readFileSync(appVersionFile, 'utf8')) as { buildId?: string }
      if (buildId) return buildId
    } catch {
      /* ignore */
    }
  }
  return 'dev'
}

const BUILD_VERSION = readBuildVersion()
const BUILD_ID = readBuildId()

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
          res.writeHead(302, { Location: `${APP_BASE}/login` })
          res.end()
          return
        }

        if (raw === APP_BASE) {
          res.writeHead(302, { Location: `${APP_BASE}/login` })
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
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    auditoriaBaseRedirect(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: [
        'Logo_Icon.png',
        'Logo_Icon-favicon.png',
        'Logo_Icon-light.png',
        'Logo_Icon-192.png',
        'Logo_Icon-512.png',
        'Logo_Icon-maskable.png',
        'logo-grupo-alvim.png',
      ],
      manifest: {
        name: 'Meridian — Grupo Alvim',
        short_name: 'Meridian',
        description: 'Chamados, checklist, frota e auditoria — Grupo Alvim',
        theme_color: '#1B2A6B',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'pt-BR',
        start_url: './login/mobile',
        scope: './',
        id: './login/mobile',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'Logo_Icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'Logo_Icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'Logo_Icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2,webmanifest}'],
        // Bundle principal ~3.4 MB após redesign mobile; margem para crescimento.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      injectRegister: false,
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    /** Permite acesso via ngrok / túnel externo no dev */
    allowedHosts: true,
    open: `${APP_BASE}/`,
    proxy: {
      [`${APP_BASE}/api`]: {
        target: `http://localhost:${DEV_API_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
