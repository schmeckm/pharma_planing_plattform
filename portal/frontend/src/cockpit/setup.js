import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import '../../../../cockpit/src/styles/main.css';

let registered = false;

export function setupCockpitPlugins(app) {
  if (registered) return;
  registered = true;

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
  }

  app.use(ElementPlus);
  app.use(PrimeVue, {
    theme: { preset: Aura, options: { darkModeSelector: false } },
  });
  app.use(ToastService);
}
