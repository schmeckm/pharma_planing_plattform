<template>

  <header class="app-header">

    <div class="app-header__left">

      <h1 class="app-header__title">{{ title }}</h1>

    </div>

    <div class="app-header__right">

      <AgentEngineToggle :show-label="false" />

      <CopilotLauncher />

      <el-button size="small" text @click="$router.push('/wizard')">
        <el-icon><Guide /></el-icon>
        {{ t('header.wizard') }}
      </el-button>

      <el-button size="small" text @click="$router.push('/help')">
        <el-icon><QuestionFilled /></el-icon>
        {{ t('header.help') }}
      </el-button>

      <el-select
        :model-value="localeStore.locale"
        size="small"
        class="lang-select"
        :placeholder="languageLabel"
        @change="localeStore.setLocale"
      >
        <el-option
          v-for="opt in localeStore.options"
          :key="opt.code"
          :label="`${opt.flag} ${opt.label}`"
          :value="opt.code"
        />
      </el-select>

      <el-tag size="small" :type="appStore.useMockData ? 'warning' : 'success'" effect="plain">

        {{ appStore.dataSourceLabel }}

      </el-tag>

      <el-tag v-if="appStore.loading" size="small" type="info" effect="plain">

        {{ t('header.loading') }}

      </el-tag>

      <el-select

        v-model="selectedUser"

        size="small"

        :placeholder="t('header.signIn')"

        class="role-select"

        @change="switchUser"

      >

        <el-option

          v-for="u in demoUsers"

          :key="u.username"

          :label="`${u.displayName} (${u.role})`"

          :value="u.username"

        />

      </el-select>

      <span class="app-header__user">

        <el-icon><User /></el-icon>

        {{ auth.user?.displayName || t('header.planner') }}

        <el-tag size="small" effect="plain">{{ auth.role }}</el-tag>

      </span>

    </div>

  </header>

</template>



<script setup>

import { ref, onMounted, computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useLocaleStore } from '@/stores/locale';
import { tAgent } from '@/i18n/agent';
import { useI18n } from '@/composables/useI18n';
import AgentEngineToggle from '@/components/shared/AgentEngineToggle.vue';
import CopilotLauncher from '@/components/shared/CopilotLauncher.vue';



defineProps({

  title: { type: String, default: 'Dashboard' },

});



const appStore = useAppStore();
const auth = useAuthStore();
const localeStore = useLocaleStore();
const { t } = useI18n();
const selectedUser = ref(auth.user?.username || 'planner');

const languageLabel = computed(() => tAgent(localeStore.locale, 'header.language'));



const demoUsers = [

  { username: 'planner', displayName: 'Maria Planner', role: 'PLANNER' },

  { username: 'qa', displayName: 'Thomas QA', role: 'QA' },

  { username: 'supplychain', displayName: 'Lisa Supply Chain', role: 'SUPPLY_CHAIN' },

  { username: 'admin', displayName: 'System Admin', role: 'ADMIN' },

  { username: 'viewer', displayName: 'Read Only User', role: 'VIEWER' },

];



onMounted(async () => {

  if (!auth.isAuthenticated) {

    await auth.login('planner');

    selectedUser.value = 'planner';

  }

});



async function switchUser(username) {

  await auth.login(username);

}

</script>



<style scoped>

.app-header {

  height: var(--header-height);

  background: var(--color-bg);

  border-bottom: 1px solid var(--color-border);

  display: flex;

  align-items: center;

  justify-content: space-between;

  padding: 0 24px;

  flex-shrink: 0;

}



.app-header__title {

  margin: 0;

  font-size: 1.125rem;

  font-weight: 600;

}



.app-header__right {

  display: flex;

  align-items: center;

  gap: 12px;

}



.app-header__user {

  display: flex;

  align-items: center;

  gap: 6px;

  font-size: 0.8125rem;

  color: var(--color-text-muted);

}



.role-select {
  width: 200px;
}

.lang-select {
  width: 130px;
}

</style>

