import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
    resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@config': fileURLToPath(new URL('../config', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.VITE_DEV_PORT) || 3001,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
