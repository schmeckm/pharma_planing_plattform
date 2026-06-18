<template>
  <footer class="app-footer">
    <div class="app-footer__left">
      <span class="app-footer__brand">Hard Allocation Platform</span>
      <span class="app-footer__sep">·</span>
      <span class="app-footer__muted">v{{ version }}</span>
      <span class="app-footer__sep">·</span>
      <span class="app-footer__muted">© {{ year }} Pharmaceutical Operations</span>
    </div>

    <div class="app-footer__right">
      <span class="app-footer__status">
        <span class="app-footer__dot" :class="`app-footer__dot--${healthState}`" />
        <span>API: {{ healthLabel }}</span>
        <span v-if="latencyMs != null" class="app-footer__muted">{{ latencyMs }} ms</span>
      </span>

      <span class="app-footer__sep">·</span>

      <el-tag size="small" :type="appStore.useMockData ? 'warning' : 'success'" effect="plain">
        {{ appStore.dataSourceLabel }}
      </el-tag>

      <span class="app-footer__sep">·</span>

      <a class="app-footer__link" :href="apiDocsUrl" target="_blank" rel="noopener">{{ t('footer.apiDocs') }}</a>
      <span class="app-footer__sep">·</span>
      <router-link class="app-footer__link" to="/help">{{ t('footer.help') }}</router-link>
    </div>
  </footer>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useI18n } from '@/composables/useI18n';

const appStore = useAppStore();
const { t } = useI18n();

const version = '2.0.0';
const year = new Date().getFullYear();

const healthState = ref('unknown'); // 'ok' | 'warn' | 'fail' | 'unknown'
const latencyMs = ref(null);
let timer = null;

const healthLabel = computed(() => t(`footer.health.${healthState.value}`));

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');
const apiDocsUrl = computed(() => `${apiBase || ''}/docs`);

async function ping() {
  const url = `${apiBase || ''}/health`;
  const start = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const elapsed = Math.round(performance.now() - start);
    latencyMs.value = elapsed;
    if (!res.ok) {
      healthState.value = 'fail';
      return;
    }
    healthState.value = elapsed > 800 ? 'warn' : 'ok';
  } catch {
    latencyMs.value = null;
    healthState.value = 'fail';
  }
}

onMounted(() => {
  ping();
  timer = setInterval(ping, 30000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 32px;
  padding: 0 16px;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.app-footer__left,
.app-footer__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  overflow: hidden;
  white-space: nowrap;
}

.app-footer__brand {
  color: var(--color-text);
  font-weight: 600;
}

.app-footer__sep {
  color: var(--color-border);
  user-select: none;
}

.app-footer__muted {
  color: var(--color-text-muted);
}

.app-footer__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.app-footer__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9aa0a6;
  box-shadow: 0 0 0 2px rgba(154, 160, 166, 0.18);
}

.app-footer__dot--ok {
  background: var(--color-success);
  box-shadow: 0 0 0 2px rgba(16, 126, 62, 0.18);
}

.app-footer__dot--warn {
  background: var(--color-warning);
  box-shadow: 0 0 0 2px rgba(233, 115, 12, 0.18);
}

.app-footer__dot--fail {
  background: var(--color-error);
  box-shadow: 0 0 0 2px rgba(187, 0, 0, 0.18);
}

.app-footer__link {
  color: var(--color-accent);
  text-decoration: none;
}

.app-footer__link:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .app-footer {
    font-size: 0.7rem;
  }
  .app-footer__left .app-footer__muted:nth-of-type(2),
  .app-footer__sep:nth-of-type(2),
  .app-footer__sep:nth-of-type(4) {
    display: none;
  }
}
</style>
