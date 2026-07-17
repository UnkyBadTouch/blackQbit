import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.CAP_BUILD ? './' : '/qbit/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: 'blackqbit',
        start_url: '/qbit/',
        scope: '/qbit/',
        name: 'blackQbit',
        short_name: 'blackQbit',
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
