<template>
  <div class="cockpit-embed" data-cockpit-theme="light" :style="embedAccentStyle">
    <RouterView v-slot="{ Component, route }">
      <component :is="Component" v-if="Component" :key="route.fullPath" class="cockpit-embed__page" />
      <p v-else class="cockpit-embed__empty">{{ t('planning.routeMissing') }}</p>
    </RouterView>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterView } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '../stores/themeStore';
import { accentCssVars } from '../utils/accentColor';
import '../cockpit/cockpitEmbedTheme.css';

const { t } = useI18n();
const { accentColor } = storeToRefs(useThemeStore());

/** Cockpit-Embed: Akzent explizit binden (Profil-Wechsel ohne Reload). */
const embedAccentStyle = computed(() => accentCssVars(accentColor.value));
</script>

<style scoped>
.cockpit-embed__page {
  min-height: 12rem;
}

.cockpit-embed__empty {
  margin: 0;
  padding: 1rem 0;
  color: var(--color-muted);
}
</style>
