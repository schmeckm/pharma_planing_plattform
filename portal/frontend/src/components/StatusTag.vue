<template>
  <div class="status-tag" :class="`status-tag--${variant}`">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'default' },
});
</script>

<style scoped>
.status-tag {
  display: inline-flex;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

.status-tag--default {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.status-tag--success {
  background: rgba(0, 230, 118, 0.15);
  color: var(--color-success);
}

.status-tag--warning {
  background: rgba(251, 191, 36, 0.15);
  color: var(--color-warning);
}
</style>
