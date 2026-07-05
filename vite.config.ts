import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all local IPs
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        complainant: resolve(__dirname, 'complainant.html'),
        manager: resolve(__dirname, 'manager.html'),
        mp: resolve(__dirname, 'mp.html'),
        track: resolve(__dirname, 'track.html'),
      },
    },
  },
})
