<template>
  <div class="layout layout--public">
    <header class="layout__header public-header">
      <RouterLink to="/" class="brand">{{ t('app.name') }}</RouterLink>
      <div class="public-header__actions">
        <button type="button" class="icon-btn" :title="t('header.theme')" @click="theme.toggle()">
          {{ theme.mode === 'dark' ? '☀' : '☾' }}
        </button>
        <select class="locale-select" :value="locale.locale" @change="onLocaleChange">
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
        <RouterLink v-if="!auth.isAuthenticated" class="btn btn--ghost" to="/login">{{ t('auth.login') }}</RouterLink>
        <RouterLink v-else class="btn" to="/dashboard">{{ t('nav.dashboard') }}</RouterLink>
      </div>
    </header>
    <main class="layout__main">
      <RouterView />
    </main>
    <footer class="layout__footer">
      <AppFooter />
    </footer>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import AppFooter from '../components/layout/AppFooter.vue';

const { t } = useI18n();
const auth = useAuthStore();
const theme = useThemeStore();
const locale = useLocaleStore();

function onLocaleChange(event) {
  locale.setLocale(event.target.value);
}
</script>

<style scoped>
.public-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.public-header__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
}

.icon-btn:hover {
  background: var(--color-accent-soft);
}

.locale-select {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 8px;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
}
</style>
