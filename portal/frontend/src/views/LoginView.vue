<template>
  <section class="page page--narrow">
    <h1>{{ t('auth.login') }}</h1>
    <p class="muted">{{ t('auth.loginHint') }}</p>

    <div v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</div>

    <form class="login-form" @submit.prevent="submit">
      <div class="form-field">
        <label for="email">{{ t('auth.email') }}</label>
        <input id="email" v-model="email" type="email" autocomplete="username" required />
      </div>
      <div class="form-field">
        <label for="password">{{ t('auth.password') }}</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required />
      </div>
      <button class="btn btn--block" type="submit" :disabled="auth.loading">
        {{ auth.loading ? t('auth.loading') : t('auth.login') }}
      </button>
    </form>

    <div class="divider">{{ t('auth.or') }}</div>

    <button type="button" class="btn btn--google btn--block" :disabled="auth.loading" @click="startGoogle">
      <span>G</span>
      {{ t('auth.googleLogin') }}
    </button>

    <p class="dev-hint muted">{{ t('auth.devHint') }}</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/authStore';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const email = ref('user@localhost');
const password = ref('user123');

const errorMessage = computed(() => auth.error || route.query.error);

async function submit() {
  try {
    await auth.login(email.value, password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    router.push(redirect);
  } catch {
    // Fehler im Store
  }
}

function startGoogle() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
  auth.startGoogleLogin(redirect);
}
</script>

<style scoped>
.login-form {
  margin-top: 1.25rem;
}

.divider {
  margin: 1rem 0;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.dev-hint {
  margin-top: 1rem;
  font-size: 0.8rem;
}
</style>
