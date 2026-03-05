import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/rest/api': {
        target: 'https://test-100.ecotec-digital.de',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    react(),
  ],
})
