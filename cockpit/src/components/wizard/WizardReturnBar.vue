<template>
  <div v-if="fromWizard" class="wizard-return">
    <span>Sie kommen vom Tages-Wizard.</span>
    <el-button type="primary" @click="completeAndReturn">
      Schritt erledigen & zurück
    </el-button>
    <el-button text @click="router.push('/wizard')">Nur zurück</el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { markWizardStepComplete } from '@/utils/dailyWizardSteps';

const route = useRoute();
const router = useRouter();

const fromWizard = computed(() => route.query.fromWizard || null);

function completeAndReturn() {
  if (fromWizard.value) markWizardStepComplete(fromWizard.value);
  router.push('/wizard');
}
</script>

<style scoped>
.wizard-return {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
  border-radius: var(--radius, 6px);
  font-size: var(--text-md);
  color: var(--color-text);
}
</style>
