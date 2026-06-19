<template>
  <div class="auth-panel">
    <h2 class="auth-panel__title">{{ t('landing.signIn') }}</h2>

    <button
      type="button"
      class="auth-panel__google"
      :disabled="auth.loading"
      @click="startGoogle"
    >
      <span class="auth-panel__google-icon" aria-hidden="true">G</span>
      {{ t('auth.googleLogin') }}
    </button>

    <div class="auth-panel__divider">
      <span>{{ t('auth.or') }}</span>
    </div>

    <div v-if="errorMessage" class="auth-panel__alert">{{ errorMessage }}</div>

    <p class="auth-panel__hint">{{ t('landing.emailHint') }}</p>

    <form class="auth-panel__form" @submit.prevent="submit">
      <div class="auth-panel__field">
        <label for="landing-email">{{ t('landing.emailLabel') }}</label>
        <input
          id="landing-email"
          v-model="email"
          type="email"
          autocomplete="username"
          :placeholder="t('landing.emailPlaceholder')"
          required
        />
      </div>

      <div class="auth-panel__field">
        <label for="landing-password">{{ t('landing.passwordLabel') }}</label>
        <div class="auth-panel__password-wrap">
          <input
            id="landing-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
          />
          <button
            type="button"
            class="auth-panel__password-toggle"
            :aria-label="showPassword ? t('landing.hidePassword') : t('landing.showPassword')"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? '🙈' : '👁' }}
          </button>
        </div>
      </div>

      <label class="auth-panel__remember">
        <input v-model="rememberMe" type="checkbox" />
        <span>{{ t('landing.rememberMe') }}</span>
      </label>

      <button class="auth-panel__submit" type="submit" :disabled="auth.loading">
        {{ auth.loading ? t('auth.loading') : t('landing.signInNow') }}
      </button>
    </form>

    <p class="auth-panel__footer-note">
      {{ t('landing.privacyPrefix') }}
      <a href="#" @click.prevent>{{ t('landing.privacyPolicy') }}</a>.
    </p>

    <p class="auth-panel__footer-note auth-panel__footer-note--muted">
      {{ t('landing.devAccounts') }}
    </p>

    <div class="auth-panel__qr">
      <img :src="qrCodeUrl" width="96" height="96" :alt="t('landing.qrAlt')" />
      <p>{{ t('landing.qrHint') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/authStore';

const REMEMBER_KEY = 'portal.rememberEmail';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const email = ref(localStorage.getItem(REMEMBER_KEY) || 'user@localhost');
const password = ref('user123');
const rememberMe = ref(Boolean(localStorage.getItem(REMEMBER_KEY)));
const showPassword = ref(false);

const errorMessage = computed(() => auth.error || route.query.error);

const qrCodeUrl = computed(() => {
  const url = typeof window !== 'undefined' ? window.location.origin : '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(url)}`;
});

watch(rememberMe, (value) => {
  if (value && email.value) {
    localStorage.setItem(REMEMBER_KEY, email.value);
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
});

watch(email, (value) => {
  if (rememberMe.value && value) {
    localStorage.setItem(REMEMBER_KEY, value);
  }
});

onMounted(() => {
  if (auth.isAuthenticated) {
    router.replace('/dashboard');
  }
});

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
.auth-panel {
  width: min(100%, 360px);
  color: #f8fafc;
}

.auth-panel__title {
  margin: 0 0 1.25rem;
  font-size: 1.35rem;
  font-weight: 700;
}

.auth-panel__google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  width: 100%;
  min-height: var(--btn-height);
  padding: var(--btn-padding-y) var(--btn-padding-x);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.auth-panel__google:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.auth-panel__google:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-panel__google-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: #fff;
  color: #4285f4;
  font-weight: 700;
  font-size: 0.85rem;
}

.auth-panel__divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1rem 0;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.85rem;
}

.auth-panel__divider::before,
.auth-panel__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
}

.auth-panel__alert {
  margin-bottom: 0.85rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.15);
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fecaca;
  font-size: 0.85rem;
}

.auth-panel__hint {
  margin: 0 0 1rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(251, 191, 36, 0.45);
  border-radius: 10px;
  background: rgba(251, 191, 36, 0.08);
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.78rem;
  line-height: 1.45;
}

.auth-panel__form {
  display: grid;
  gap: 0.85rem;
}

.auth-panel__field {
  display: grid;
  gap: 0.35rem;
}

.auth-panel__field label {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.72);
}

.auth-panel__field input {
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
}

.auth-panel__field input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.auth-panel__field input:focus {
  outline: 2px solid var(--color-accent-soft);
  border-color: var(--color-accent);
}

.auth-panel__password-wrap {
  position: relative;
}

.auth-panel__password-wrap input {
  padding-right: 2.5rem;
}

.auth-panel__password-toggle {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.95rem;
  opacity: 0.75;
}

.auth-panel__remember {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
}

.auth-panel__submit {
  width: 100%;
  margin-top: 0.25rem;
  min-height: var(--btn-height);
  padding: var(--btn-padding-y) var(--btn-padding-x);
  border: none;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-on, #fff);
  font-size: var(--btn-font-size);
  font-weight: var(--btn-font-weight);
  cursor: pointer;
  transition: background 0.15s ease;
}

.auth-panel__submit:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.auth-panel__submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.auth-panel__footer-note {
  margin: 0.85rem 0 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.45;
}

.auth-panel__footer-note a {
  color: var(--color-accent);
  text-decoration: underline;
}

.auth-panel__footer-note--muted {
  color: rgba(255, 255, 255, 0.45);
}

.auth-panel__qr {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.auth-panel__qr img {
  border-radius: 10px;
  background: #fff;
  padding: 0.35rem;
}

.auth-panel__qr p {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
}
</style>
