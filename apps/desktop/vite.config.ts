import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import url from 'url'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue(), tailwindcss()],

  resolve: {
    alias: {
      '@linkbase/core': resolve(__dirname, '../../packages/core/src'),
      '@linkbase/components': resolve(__dirname, '../../packages/components/src'),
      '@linkbase/connection': resolve(__dirname, '../../packages/connection/src'),
      '@linkbase/editor': resolve(__dirname, '../../packages/editor/src'),
      '@linkbase/result': resolve(__dirname, '../../packages/result/src'),
      '@linkbase/schema': resolve(__dirname, '../../packages/schema/src'),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  optimizeDeps: {
    include: ['@tauri-apps/api', '@tauri-apps/api/core'],
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
