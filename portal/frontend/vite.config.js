import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { cockpitAliasPlugin } from './vite.cockpit-alias.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const portalApi = env.VITE_API_URL || 'http://localhost:3000';
  const allocationApi = env.VITE_ALLOCATION_API_URL || 'http://127.0.0.1:8000';

  const portalRoot = __dirname;
  const portalNodeModules = path.resolve(portalRoot, 'node_modules');

  return {
    plugins: [
      cockpitAliasPlugin(),
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Hard Allocation Portal',
          short_name: 'Portal',
          theme_color: '#121212',
          background_color: '#121212',
          display: 'standalone',
          icons: [],
        },
      }),
    ],
    resolve: {
      dedupe: ['vue', 'pinia', 'vue-router', 'primevue', '@primevue/themes'],
      alias: {
        primevue: path.resolve(portalNodeModules, 'primevue'),
      },
    },
    optimizeDeps: {
      include: [
        'element-plus',
        '@element-plus/icons-vue',
        'primevue/config',
        'primevue/toast',
        'primevue/toastservice',
        'primevue/usetoast',
        'primevue/toasteventbus',
        '@primevue/themes/aura',
        'chart.js',
        'vue-chartjs',
        'frappe-gantt',
      ],
    },
    server: {
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
          path.resolve(__dirname, '../..'),
          path.resolve(__dirname, '../../cockpit'),
          path.resolve(__dirname, '../../config'),
        ],
      },
      port: 5173,
      proxy: {
        '/api/v1': { target: allocationApi, changeOrigin: true },
        '/api/v2': { target: allocationApi, changeOrigin: true },
        '/api/v3': { target: allocationApi, changeOrigin: true },
        '/api/v4': { target: allocationApi, changeOrigin: true },
        '/api/v5': { target: allocationApi, changeOrigin: true },
        '/ws': { target: allocationApi, ws: true, changeOrigin: true },
        '/api': { target: portalApi, changeOrigin: true },
        '/socket.io': { target: portalApi, ws: true },
      },
    },
  };
});
