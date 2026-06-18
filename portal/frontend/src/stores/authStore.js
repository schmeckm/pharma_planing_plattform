import { defineStore } from 'pinia';
import api from '../services/api';
import { applyCockpitAuthToStore, clearCockpitAuth } from '../cockpit/authBridge';

const STORAGE_KEY = 'portal.auth';

function loadPersisted() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function apiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: loadPersisted().token || null,
    refreshToken: loadPersisted().refreshToken || null,
    user: loadPersisted().user || null,
    loading: false,
    error: null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    isAdmin: (state) => state.user?.role === 'admin',
  },
  actions: {
    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token: this.token,
          refreshToken: this.refreshToken,
          user: this.user,
        })
      );
    },
    async setSession({ token, refreshToken, user }) {
      this.token = token;
      this.refreshToken = refreshToken;
      this.user = user;
      this.error = null;
      this.persist();
      await applyCockpitAuthToStore(user);
    },
    async logout() {
      try {
        if (this.token) {
          await api.post('/api/auth/logout', { refreshToken: this.refreshToken });
        }
      } catch {
        // Abmeldung trotzdem lokal durchführen
      }
      this.token = null;
      this.refreshToken = null;
      this.user = null;
      localStorage.removeItem(STORAGE_KEY);
      clearCockpitAuth();
    },
    async fetchMe() {
      const { data } = await api.get('/api/auth/me');
      this.user = data.user;
      this.persist();
      await applyCockpitAuthToStore(this.user);
    },
    async login(email, password) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.post('/api/auth/login', { email, password });
        await this.setSession(data);
        return data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Anmeldung fehlgeschlagen';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    startGoogleLogin(redirect = '/dashboard') {
      const base = apiBaseUrl();
      const path = `/api/auth/google?redirect=${encodeURIComponent(redirect)}`;
      window.location.href = base ? `${base}${path}` : path;
    },
    async exchangeCode(code) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.post('/api/auth/exchange', { code });
        await this.setSession(data);
        return data;
      } catch (err) {
        this.error = err.response?.data?.error || 'OAuth-Austausch fehlgeschlagen';
        throw err;
      } finally {
        this.loading = false;
      }
    },
  },
});