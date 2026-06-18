<template>
  <span class="status-tag" :class="`status-tag--${variant}`">{{ status }}</span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, default: 'OPEN' },
});

const variant = computed(() => {
  const map = {
    SUCCESS: 'success',
    SIMULATED: 'info',
    FAILED: 'error',
    OPEN: 'neutral',
    ALLOCATED: 'success',
    PARTIALLY_ALLOCATED: 'warning',
    CLOSED: 'neutral',
    RELEASED: 'success',
    BLOCKED: 'error',
    SKIPPED: 'neutral',
    QUARANTINE: 'warning',
    PASSED: 'success',
    PENDING: 'warning',
  };
  return map[props.status] || 'neutral';
});
</script>
