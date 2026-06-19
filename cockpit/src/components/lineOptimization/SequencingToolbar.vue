<template>
  <div class="seq-toolbar panel">
    <div class="seq-toolbar-groups">
      <div class="seq-group">
        <span class="toolbar-group-label">{{ SEQ_LABELS.TOOLBAR_PLAN }}</span>
        <div class="seq-group-actions">
          <Button
            :label="SEQ_LABELS.BUILD_SEQUENCE"
            icon="pi pi-sliders-h"
            :loading="loading"
            @click="$emit('optimize')"
          />
        </div>
      </div>

      <div class="seq-divider" aria-hidden="true" />

      <div class="seq-group">
        <span class="toolbar-group-label">{{ SEQ_LABELS.TOOLBAR_SIMULATE }}</span>
        <div class="seq-group-actions">
          <Button
            :label="SEQ_LABELS.WHAT_IF"
            icon="pi pi-play"
            severity="secondary"
            outlined
            :loading="loading"
            @click="$emit('what-if')"
          />
        </div>
      </div>

      <div class="seq-divider" aria-hidden="true" />

      <div class="seq-group seq-group-publish">
        <span class="toolbar-group-label">{{ SEQ_LABELS.TOOLBAR_PUBLISH }}</span>
        <div class="seq-group-actions">
          <Button
            :label="SEQ_LABELS.SAVE_DRAFT"
            icon="pi pi-save"
            severity="secondary"
            outlined
            :loading="loading"
            @click="$emit('save-draft')"
          />
          <Button
            :label="SEQ_LABELS.CONFIRM"
            icon="pi pi-check"
            severity="secondary"
            outlined
            :loading="loading"
            @click="$emit('confirm')"
          />
          <Button
            v-if="shadowPlanning"
            :label="SEQ_LABELS.ACTIVATE"
            icon="pi pi-bolt"
            :loading="loading"
            :disabled="!canActivate"
            :title="activateTooltip"
            @click="$emit('activate')"
          />
        </div>
      </div>

      <div class="seq-toolbar-end">
        <Tag
          v-if="routingSourceBadge"
          v-tooltip="routingSourceBadge.detail"
          :value="routingSourceBadge.label"
          :severity="routingSourceBadge.severity"
          class="seq-solver-tag"
        />
        <Tag
          v-if="operationsSolverBadge"
          v-tooltip="operationsSolverBadge.detail"
          :value="operationsSolverBadge.label"
          :severity="operationsSolverBadge.severity"
          class="seq-solver-tag"
        />
        <Tag
          v-if="solverBadge"
          v-tooltip="solverBadge.detail"
          :value="solverBadge.label"
          :severity="solverBadge.severity"
          class="seq-solver-tag"
        />
        <Button
          :label="SEQ_LABELS.MORE"
          icon="pi pi-ellipsis-v"
          severity="secondary"
          text
          :loading="loading"
          @click="toggleMore"
          aria-haspopup="true"
          aria-controls="seq-more-menu"
        />
        <Menu id="seq-more-menu" ref="moreMenu" :model="moreItems" :popup="true" />
      </div>
    </div>
    <p class="toolbar-hint">{{ workflowHint }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import Menu from 'primevue/menu';
import Tag from 'primevue/tag';
import { PLANNER_LABELS } from '@/utils/plannerTerminology';
import { SEQ_LABELS } from '@/utils/sequencingLabels';

const props = defineProps({
  loading: { type: Boolean, default: false },
  shadowPlanning: { type: Boolean, default: false },
  canActivate: { type: Boolean, default: false },
  solverBadge: { type: Object, default: null },
  operationsSolverBadge: { type: Object, default: null },
  routingSourceBadge: { type: Object, default: null },
});

const emit = defineEmits(['optimize', 'what-if', 'save-draft', 'confirm', 'activate', 'batch', 'refresh']);

const moreMenu = ref(null);

const activateTooltip = computed(() => (
  props.canActivate ? SEQ_LABELS.ACTIVATE_READY : SEQ_LABELS.ACTIVATE_BLOCKED
));

const workflowHint = computed(() => (
  props.shadowPlanning ? SEQ_LABELS.WORKFLOW_SHADOW : SEQ_LABELS.WORKFLOW_DIRECT
));

const moreItems = computed(() => [
  {
    label: PLANNER_LABELS.BATCH_RECOMMENDATIONS,
    icon: 'pi pi-box',
    command: () => emit('batch'),
  },
  { separator: true },
  {
    label: SEQ_LABELS.REFRESH,
    icon: 'pi pi-refresh',
    command: () => emit('refresh'),
  },
]);

function toggleMore(event) {
  moreMenu.value?.toggle(event);
}
</script>

<style scoped>
.seq-toolbar {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-panel);
}

.seq-toolbar-groups {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem 0;
}

.seq-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0 0.75rem 0 0;
}

.seq-group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.seq-divider {
  width: 1px;
  align-self: stretch;
  min-height: 2.5rem;
  margin: 0 0.25rem;
  background: var(--color-border);
}

.seq-toolbar-end {
  margin-left: auto;
  align-self: flex-end;
  padding-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.seq-solver-tag {
  font-size: var(--text-sm);
}

@media (max-width: 900px) {
  .seq-divider { display: none; }
  .seq-group {
    width: 100%;
    padding-right: 0;
    border-bottom: 1px solid var(--help-surface-strong);
    padding-bottom: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .seq-toolbar-end {
    margin-left: 0;
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
