import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works on GitHub Pages / any static host subpath
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
