import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' => works from any GitHub Pages repository subdirectory
// e.g. https://s16404367-code.github.io/crazy/  (never assume root hosting)
// singlefile => the ready-to-play build is ONE self-contained index.html,
// so the extracted ZIP also opens by double-click (file://) with no server.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4000,
    cssCodeSplit: false
  },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true }
});
