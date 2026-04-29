import { defineConfig } from 'vite';

// base must match the GitHub Pages repo path so asset URLs resolve in production.
export default defineConfig({
  base: '/campanile/',
  server: {
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
