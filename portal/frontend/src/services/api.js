import axios from 'axios';
import router from '../router';
import { useAuthStore } from '../stores/authStore';
import { useLocaleStore } from '../stores/localeStore';
import { useToastStore } from '../stores/toastStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const auth = useAuthStore();
  const locale = useLocaleStore();

  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }

  config.headers['X-Language'] = locale.locale;

  if (config.method === 'get') {
    config.params = { ...config.params, lang: locale.locale };
  }

  return config;
});

let refreshPromise;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const auth = useAuthStore();
    const toast = useToastStore();
    const original = error.config;

    if (error.response?.status === 429) {
      toast.show('Too many requests', 'error');
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && auth.refreshToken && !original._retry) {
      original._retry = true;

      refreshPromise =
        refreshPromise ||
        api.post('/api/auth/refresh', { refreshToken: auth.refreshToken }).finally(() => {
          refreshPromise = null;
        });

      try {
        const { data } = await refreshPromise;
        auth.setSession({
          token: data.token,
          refreshToken: data.refreshToken,
          user: auth.user,
        });
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch {
        auth.logout();
        router.push({ name: 'login' });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
