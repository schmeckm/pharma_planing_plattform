<template>
  <div class="rules-help panel">
    <el-collapse v-model="open">
      <el-collapse-item name="help">
        <template #title>
          <span class="rules-help__title">
            <el-icon class="rules-help__icon"><QuestionFilled /></el-icon>
            {{ help.title }}
          </span>
        </template>

        <div class="rules-help__body">
          <p class="rules-help__intro" v-html="renderMd(help.intro)" />

          <RulesAllocationFlowChart
            :title="help.flowchartTitle"
            :caption="help.flowchartCaption"
            :steps="help.flowchart"
          />

          <RulesLayersDiagram
            :title="help.layersDiagramTitle"
            :diagram="help.layersDiagram"
          />

          <RulesExecutionTimeline :config="help.executionTimeline" />

          <RulesValidityTimeline
            :config="help.validityTimeline"
            :rule-definitions="ruleDefinitions"
          />

          <div v-if="help.solverStrategy" class="rules-help__solver panel-inner">
            <h4>{{ help.solverStrategy.title }}</h4>
            <p class="rules-help__intro" v-html="renderMd(help.solverStrategy.intro)" />
            <ol class="rules-help__list">
              <li v-for="(step, i) in help.solverStrategy.pipeline" :key="i">{{ step }}</li>
            </ol>
            <p class="rules-help__solver-env">
              <strong>.env:</strong>
              <code v-for="(key, i) in help.solverStrategy.envKeys" :key="key">
                {{ key }}<span v-if="i < help.solverStrategy.envKeys.length - 1"> · </span>
              </code>
            </p>
          </div>

          <h4>Zwei Ebenen (Detail)</h4>
          <el-table :data="help.layers" size="small" stripe class="rules-help__table">
            <el-table-column prop="name" label="Ebene" width="200" />
            <el-table-column prop="where" label="Wo" width="220" />
            <el-table-column prop="role" label="Rolle" min-width="280" />
          </el-table>

          <h4>Ablauf bei Simulate / Allocate</h4>
          <ol class="rules-help__list">
            <li v-for="(step, i) in help.flow" :key="i" v-html="renderMd(step)" />
          </ol>

          <h4>Country Rules → Gate-Regeln</h4>
          <el-table :data="help.countryMapping" size="small" stripe class="rules-help__table">
            <el-table-column prop="field" label="Country Rule Feld" width="220" />
            <el-table-column prop="rule" label="Gate-Regel" width="100" />
            <el-table-column prop="effect" label="Wirkung" min-width="320" />
          </el-table>

          <h4>Immer global (nicht landesspezifisch)</h4>
          <ul class="rules-help__list rules-help__list--bullet">
            <li v-for="(item, i) in help.globalRules" :key="i">{{ item }}</li>
          </ul>

          <h4>Gültigkeit von / bis</h4>
          <ul class="rules-help__list rules-help__list--bullet">
            <li v-for="(item, i) in help.validity" :key="i" v-html="renderMd(item)" />
          </ul>

          <h4>Tipps</h4>
          <ul class="rules-help__list rules-help__list--bullet">
            <li v-for="(item, i) in help.editHints" :key="i" v-html="item" />
          </ul>

          <p class="rules-help__footer">
            Ausführliche Plattform-Hilfe:
            <router-link to="/help">Hilfe &amp; Überblick</router-link>
            · Enterprise-Regeln:
            <router-link to="/rule-management">Rule Management</router-link>
          </p>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { QuestionFilled } from '@element-plus/icons-vue';
import { RULES_CONFIGURATION_HELP } from '@/utils/helpContent';
import RulesAllocationFlowChart from '@/components/rules/RulesAllocationFlowChart.vue';
import RulesLayersDiagram from '@/components/rules/RulesLayersDiagram.vue';
import RulesExecutionTimeline from '@/components/rules/RulesExecutionTimeline.vue';
import RulesValidityTimeline from '@/components/rules/RulesValidityTimeline.vue';

const props = defineProps({
  ruleDefinitions: { type: Array, default: () => [] },
});

const help = RULES_CONFIGURATION_HELP;
const open = ref(['help']);

function renderMd(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
</script>

<style scoped>
.rules-help {
  margin-bottom: 20px;
  overflow: hidden;
}

.rules-help__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.rules-help__icon {
  color: var(--el-color-primary);
}

.rules-help__body {
  padding: 0 4px 8px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-text, #374151);
}

.rules-help__intro {
  margin: 0 0 16px;
}

.rules-help__body :deep(.rules-flow),
.rules-help__body :deep(.layers-diagram),
.rules-help__body :deep(.exec-timeline),
.rules-help__body :deep(.validity-timeline) {
  margin-bottom: 20px;
}

.rules-help h4 {
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #111827);
}

.rules-help__table {
  margin-bottom: 4px;
}

.rules-help__list {
  margin: 0 0 8px;
  padding-left: 1.25rem;
}

.rules-help__list--bullet {
  list-style: disc;
}

.rules-help__footer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
}

.rules-help__footer a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.rules-help__footer a:hover {
  text-decoration: underline;
}

.rules-help__solver {
  margin-bottom: 20px;
  padding: 12px 14px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.rules-help__solver-env {
  margin: 10px 0 0;
  font-size: 11px;
  color: #475569;
}

.rules-help__solver-env code {
  font-size: 10px;
  background: rgb(255 255 255 / 80%);
  padding: 2px 5px;
  border-radius: 4px;
}

:deep(.el-collapse-item__header) {
  padding: 0 16px;
  height: 48px;
  background: #fafbfc;
  border-bottom: none;
}

:deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

:deep(.el-collapse-item__content) {
  padding: 12px 16px 16px;
}
</style>
