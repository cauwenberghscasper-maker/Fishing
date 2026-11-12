import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// A build stamp shown on the title screen and in Settings, so anyone can tell at a glance whether
// their phone has the newest version (Casper 12 Nov: "I can't see any changes").
let sha = 'dev';
try { sha = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* no git */ }
const stamp = `${new Date().toISOString().slice(0, 10)} · ${sha}`;

// Relative base so the build works under https://<user>.github.io/Fishing/
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(stamp) },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
