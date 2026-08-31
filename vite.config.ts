import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'Zamane',
        short_name: 'Zamane',
        description: 'Shared trips, shopping, and goals for you and your partner.',
        // The colour the OS paints the status/notification bar with when the
        // PWA launches, before any JS runs. It was the brand violet, which is
        // neither of the app's two backgrounds — so an installed launch
        // flashed a violet bar above a cream (or near-black) page. Matching
        // --background means the seam is invisible; ThemeColorSync takes over
        // from here and follows the chosen theme.
        theme_color: '#F5EFF2',
        background_color: '#F5EFF2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // There is deliberately no /api rule here.
          //
          // There used to be one — `urlPattern: /^\/api\//, handler:
          // 'NetworkOnly'` — and it never matched anything: Workbox tests a
          // RegExp urlPattern against the FULL href ("https://host/api/home"),
          // which a pattern anchored to a leading slash cannot match. Replacing
          // it with a pathname callback made it match, and that turned out to
          // be worse than the bug: a matched route means Workbox answers the
          // fetch event itself, so every API call is issued from the service
          // worker instead of the page. That adds a hop, ties API traffic to
          // the worker's lifecycle, and on iOS the worker is the least reliable
          // part of the stack.
          //
          // An unmatched request is not handled by Workbox at all — the browser
          // performs it directly, which is exactly what API calls should do. So
          // the rule is gone rather than fixed. navigateFallbackDenylist below
          // still needs its /^\/api\// form: that one IS tested against
          // pathname + search, so it works as written.
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: ({ request }) => ['style', 'script', 'font'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'assets' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
