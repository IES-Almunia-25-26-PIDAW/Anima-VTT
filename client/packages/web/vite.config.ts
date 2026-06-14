import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vtt/shared': path.resolve(__dirname, '../shared/src')
    },
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  server: {
    host: true,   // bind to 0.0.0.0 so players on the VPN can reach the dev server
    port: 5173,
  },
})
