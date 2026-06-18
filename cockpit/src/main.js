import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';

import App from './App.vue';
import router, { setupRouterGuards } from './router';
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(pinia);
setupRouterGuards(router);
app.use(router);
app.use(ElementPlus);
app.use(PrimeVue, {
  theme: { preset: Aura, options: { darkModeSelector: false } },
});
app.use(ToastService);
app.mount('#app');
