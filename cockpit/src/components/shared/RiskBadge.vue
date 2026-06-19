<template>
  <Tag :severity="severity" :value="level" class="risk-badge" />
</template>

<script setup>
import { computed } from 'vue';
import Tag from 'primevue/tag';

const props = defineProps({
  level: { type: String, default: 'LOW' },
  score: Number,
});

const severity = computed(() => {
  const map = { LOW: 'success', MEDIUM: 'warn', HIGH: 'danger' };
  return map[props.level] || 'info';
});
</script>

<style scoped>
.risk-badge { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); }
</style>
