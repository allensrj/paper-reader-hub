import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5279, host: '127.0.0.1' },
  preview: { port: 5278, host: '127.0.0.1' },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000, target: 'es2020' },
})
