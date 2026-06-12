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
  }
})
