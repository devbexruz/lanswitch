import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: [
      'lanswitch.developerlogic.uz',
      'localhost'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5273',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
