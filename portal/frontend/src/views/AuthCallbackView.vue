<template>
  <section class="page page--narrow">
    <h1>{{ t('auth.callbackTitle') }}</h1>
    <p class="muted">{{ t('auth.callbackHint') }}</p>
    <p v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</p>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/authStore';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const errorMessage = ref('');

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : '';
  if (!code) {
    errorMessage.value = t('auth.callbackMissingCode');
    return;
  }

  try {
    const data = await auth.exchangeCode(code);
    router.replace(data.redirect || '/dashboard');
  } catch (err) {
    errorMessage.value = auth.error || t('auth.callbackFailed');
    setTimeout(() => router.replace({ name: 'login' }), 2000);
  }
});
</script>
