import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.CAP_BUILD ? './' : '/qbit/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' '))
  },
  plugins: [
    react(),
    VitePWA({
      // Native APK ships assets locally already — a service worker there is pure stale-cache
      // risk (surfaced as "reinstalling never picks up the new version") with zero benefit.
      injectRegister: process.env.CAP_BUILD ? false : 'auto',
      registerType: 'autoUpdate',
      manifest: {
        id: 'pineappleqbit',
        start_url: '/qbit/',
        scope: '/qbit/',
        name: 'pineappleQbit',
        short_name: 'pineappleQbit',
        description: 'qBittorrent remote',
        theme_color: '#0a0e16',
        background_color: '#0a0e16',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ]
})
