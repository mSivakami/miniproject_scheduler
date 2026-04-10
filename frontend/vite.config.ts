import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Load .env from the project root (one level above frontend/)
  // so there is only ONE .env file for the whole project
  envDir: path.resolve(__dirname, '..'),
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
