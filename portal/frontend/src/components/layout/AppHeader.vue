<template>
  <header class="app-header">
    <div class="app-header__left">
      <h1 class="app-header__title">{{ title }}</h1>
    </div>

    <div class="app-header__actions">
      <button type="button" class="icon-btn" :title="t('header.theme')" @click="theme.toggle()">
        {{ theme.mode === 'dark' ? '☀' : '☾' }}
      </button>

      <select class="locale-select" :value="locale.locale" @change="onLocaleChange">
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>

      <div v-if="auth.user" class="user-chip">
        <div class="user-chip__meta">
          <span class="user-chip__name">{{ auth.user.displayName }}</span>
          <span class="role-badge" :class="`role-badge--${auth.user.role}`">{{ roleLabel }}</span>
        </div>
        <button type="button" class="link-btn" @click="logout">{{ t('auth.logout') }}</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLocaleStore } from '../../stores/localeStore';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const theme = useThemeStore();
const locale = useLocaleStore();

const title = computed(() => {
  if (route.meta.titleKey) return t(route.meta.titleKey);
  return t('app.name');
});

const roleLabel = computed(() => {
  if (auth.user?.role === 'admin') return t('roles.admin');
  return t('roles.user');
});

function onLocaleChange(event) {
  locale.setLocale(event.target.value);
}

async function logout() {
  await auth.logout();
  router.push({ name: 'home' });
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  height: 100%;
}

.app-header__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-btn,
.link-btn {
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
}

.icon-btn:hover,
.link-btn:hover {
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

.user-chip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-chip__meta {
  display: grid;
  gap: 0.15rem;
  text-align: right;
}

.user-chip__name {
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
