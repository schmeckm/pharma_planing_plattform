<template>
  <div class="cockpit-layout">
    <Toast position="top-right" />
    <div class="cockpit-body">
      <AppSidebar />
      <div class="cockpit-main">
        <AppHeader :title="pageTitle" />
        <main class="cockpit-content">
          <el-alert
            v-if="appStore.error"
            type="error"
            :title="appStore.error"
            show-icon
            closable
            class="global-alert"
            @close="appStore.clearError()"
          />
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </main>
      </div>
    </div>
    <AppFooter />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useI18n } from '@/composables/useI18n';
import { t as translate } from '@/i18n';
import Toast from 'primevue/toast';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppFooter from '@/components/layout/AppFooter.vue';

const route = useRoute();
const appStore = useAppStore();
const { locale, routeTitle } = useI18n();
const pageTitle = computed(() => routeTitle(route.name));

watch(
  [() => route.name, locale],
  () => {
    const title = pageTitle.value;
    document.title = `${title} | ${translate(locale.value, 'app.platformTitle')}`;
  },
  { immediate: true },
);
</script>

<style scoped>
.cockpit-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.cockpit-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.cockpit-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg);
}

.cockpit-content {
  flex: 1;
  overflow: auto;
}

.global-alert {
  margin-bottom: 16px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
