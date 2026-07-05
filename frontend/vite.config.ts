import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Polyfill `global` for sockjs-client
  define: { global: 'globalThis' },

  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/ws':  { target: 'http://localhost:8080', ws: true, changeOrigin: true },
      '/socket.io': { target: 'http://localhost:8080', ws: true },
    },
  },

  build: {
    // Code splitting: vendor chunks for caching
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Map library
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
          // Charts
          'charts-vendor': ['recharts'],
          // WebSocket
          'ws-vendor': ['@stomp/stompjs', 'sockjs-client'],
        },
      },
    },
    // Raise warning threshold (1MB chunks after split is acceptable for this app)
    chunkSizeWarningLimit: 600,
  },
})
