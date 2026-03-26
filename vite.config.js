import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Law-Library-Catalog/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'sql-wasm.wasm'],
      manifest: {
        name: 'Law Library',
        short_name: 'Law Library',
        description: 'Персональный каталог правовой библиотеки',
        theme_color: '#0f1220',
        background_color: '#0f1220',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/Law-Library-Catalog/',
        scope: '/Law-Library-Catalog/',
        lang: 'ru',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Precache all built assets (JS, CSS, HTML, WASM)
        globPatterns: ['**/*.{js,css,html,svg,wasm,woff2}'],
        // Don't cache Yandex/GitHub/Anthropic API calls
        navigateFallback: '/Law-Library-Catalog/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
