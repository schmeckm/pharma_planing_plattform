<template>
  <el-button
    v-if="canUseCopilot"
    type="primary"
    size="small"
    class="copilot-launcher"
    @click="go"
  >
    <el-icon><ChatDotRound /></el-icon>
    {{ label }}
  </el-button>
  <el-button
    v-else-if="showDisabledHint"
    size="small"
    disabled
    title="Role without copilot permission"
  >
    Copilot
  </el-button>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ChatDotRound } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useLocaleStore } from '@/stores/locale';

defineProps({
  showDisabledHint: { type: Boolean, default: false },
});

const router = useRouter();
const auth = useAuthStore();
const localeStore = useLocaleStore();

const canUseCopilot = computed(() =>
  auth.hasPermission('copilot:use') && auth.hasFeature('planning-copilot'),
);

const label = computed(() => {
  const loc = localeStore.locale;
  return { de: 'Copilot', en: 'Copilot', fr: 'Copilot' }[loc] || 'Copilot';
});

function go() {
  router.push('/copilot-v3');
}
</script>

<style scoped>
.copilot-launcher {
  font-weight: 600;
}
</style>
