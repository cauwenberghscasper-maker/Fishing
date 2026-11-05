import { defineConfig } from 'vite';

// Relative base so the build works under https://<user>.github.io/Fishing/
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
