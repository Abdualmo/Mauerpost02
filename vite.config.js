import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // App ships as a single self-contained HTML (also for USB). Prevent Vite
    // from code-splitting off dynamic imports, otherwise the inline-bundler
    // in scripts/build-single.mjs misses chunks.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
