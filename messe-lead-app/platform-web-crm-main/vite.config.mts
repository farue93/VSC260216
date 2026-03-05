import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: '.',
  // Serve everything in ./assets as static files at the web root.
  // Example: assets/tesseract/tesseract.min.js => /tesseract/tesseract.min.js
  publicDir: 'assets',
  server: {
    port: 8080,
    open: false,
    // Forward /rest/api/* to the backend in all modes.
    proxy: {
      '/rest/api': {
        target: 'https://test-100.ecotec-digital.de',
        changeOrigin: true,
      },
    },
  },
}));

