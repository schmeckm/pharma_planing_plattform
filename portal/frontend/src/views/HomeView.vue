<template>
  <section class="page page--hero">
    <div class="hero">
      <div>
        <h1 class="hero__title">{{ t('home.title') }}</h1>
        <p class="muted">{{ t('home.subtitle') }}</p>
      </div>

      <div class="hero__actions">
        <button type="button" class="btn btn--google" @click="startGoogle">
          <span>G</span>
          {{ t('auth.googleLogin') }}
        </button>
        <RouterLink class="btn" to="/login">{{ t('auth.emailLogin') }}</RouterLink>
        <RouterLink v-if="auth.isAuthenticated" class="btn btn--ghost" to="/dashboard">
          {{ t('nav.dashboard') }}
        </RouterLink>
      </div>

      <div class="feature-grid">
        <article v-for="feature in features" :key="feature.title" class="feature-card">
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/authStore';

const { t } = useI18n();
const auth = useAuthStore();

const features = computed(() => [
  { title: t('home.features.authTitle'), text: t('home.features.authText') },
  { title: t('home.features.rolesTitle'), text: t('home.features.rolesText') },
  { title: t('home.features.statusTitle'), text: t('home.features.statusText') },
]);

function startGoogle() {
  auth.startGoogleLogin('/dashboard');
}
</script>
