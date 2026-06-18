<template>
  <div class="quick-actions">
    <el-button type="primary" :icon="Cpu" @click="$emit('simulate')">Start Simulation</el-button>
    <el-button :icon="CopyDocument" @click="$emit('mass-simulate')">Mass Simulate</el-button>
    <el-button type="success" :icon="CircleCheck" @click="$emit('mass-allocate')">Mass Allocation</el-button>
    <el-button type="warning" :icon="RefreshLeft" @click="$emit('mass-unallocate')">Mass Unallocate</el-button>
    <el-button :icon="CircleCheck" @click="$emit('execute')">Execute Allocation</el-button>
    <el-button :icon="Upload" @click="$emit('upload')">Upload JSON</el-button>
  </div>
</template>

<script setup>
import { Cpu, CopyDocument, CircleCheck, Upload, RefreshLeft } from '@element-plus/icons-vue';

defineEmits(['simulate', 'mass-simulate', 'mass-allocate', 'mass-unallocate', 'execute', 'upload']);
</script>

<style scoped>
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
