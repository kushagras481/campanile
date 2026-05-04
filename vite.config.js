import { defineConfig } from 'vite';
import { resolve } from 'path';

// base must match the GitHub Pages repo path so asset URLs resolve in production.
export default defineConfig({
  base: '/campanile/',
  server: {
    open: true,
  },
  build: {
    // esnext: enables top-level await (used in main.js for the glTF load).
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        demo: resolve(__dirname, 'demo.html'),
      },
    },
  },
});
