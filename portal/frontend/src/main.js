import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import { initSentry } from './sentry';
import { useThemeStore } from './stores/themeStore';
import { useAuthStore } from './stores/authStore';
import { setupCockpitPlugins } from './cockpit/setup';
import { applyCockpitAuthToStore } from './cockpit/authBridge';
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
setupCockpitPlugins(app);
app.use(i18n);
app.use(router);

initSentry(app, router);

const themeStore = useThemeStore(pinia);
themeStore.init();

const authStore = useAuthStore(pinia);
if (authStore.isAuthenticated && authStore.user) {
  authStore.syncThemeFromUser(authStore.user);
  applyCockpitAuthToStore(authStore.user).catch(() => {});
}

app.mount('#app');
