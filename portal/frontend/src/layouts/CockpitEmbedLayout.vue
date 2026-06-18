<template>
  <div class="cockpit-embed">
    <Toast position="top-right" />
    <el-alert
      v-if="appStore.error"
      type="error"
      :title="appStore.error"
      show-icon
      closable
      class="cockpit-embed__alert"
      @close="appStore.clearError()"
    />
    <RouterView v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router';
import Toast from 'primevue/toast';
import { useAppStore } from '../../../../cockpit/src/stores/app.js';

const appStore = useAppStore();
</script>

<style scoped>
.cockpit-embed {
  min-height: calc(100vh - var(--header-height) - var(--footer-height) - 2.5rem);
  margin: -1.25rem;
  padding: 1rem 1.25rem 1.5rem;
  background: #f5f6f7;
  color: #0f172a;
}

.cockpit-embed__alert {
  margin-bottom: 1rem;
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
