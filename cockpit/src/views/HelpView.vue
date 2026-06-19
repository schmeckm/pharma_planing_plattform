<template>
  <div class="help-view">
    <p class="page-subtitle">{{ pageSubtitle }}</p>

    <!-- Lean Hero -->
    <section class="help-hero panel">
      <h2 class="help-hero__title">{{ summary.title }}</h2>
      <p class="help-hero__lead" v-html="renderMd(summary.paragraphs[0])" />
      <router-link :to="planningPath('/wizard')" class="help-cta help-cta--primary">
        Tages-Wizard starten
      </router-link>
    </section>

    <!-- Kompakter Tagesablauf -->
    <section class="panel">
      <div class="panel-header">
        <h2>{{ workflowTitle }}</h2>
      </div>
      <div class="panel-body panel-body--flush">
        <table class="steps-table">
          <thead class="steps-table__sr">
            <tr>
              <th scope="col">Schritt</th>
              <th scope="col">Titel</th>
              <th scope="col">Aktion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="step in workflowSteps" :key="step.path + step.step">
              <td class="steps-table__num">{{ step.step }}</td>
              <td class="steps-table__title">
                {{ step.title }}
                <span v-if="step.label && step.label !== step.title" class="steps-table__label">
                  — {{ step.label }}
                </span>
              </td>
              <td class="steps-table__action">
                <router-link :to="planningPath(step.path)">Öffnen</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Sekundärinhalte hinter Tabs -->
    <section class="panel">
      <el-tabs v-model="activeTab" class="help-tabs">
        <el-tab-pane label="Seiten" name="pages">
          <p v-if="isPortalPlanning" class="tab-hint">
            Entspricht dem Menü links — nur Module, die für Sie freigeschaltet sind.
          </p>
          <el-input
            v-model="pageFilter"
            size="small"
            clearable
            placeholder="Seite suchen…"
            class="help-search"
          />
          <table class="guide-table">
            <thead>
              <tr>
                <th>Seite</th>
                <th>Wofür?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="page in filteredPages" :key="page.path + page.name">
                <td><strong>{{ page.name }}</strong></td>
                <td>{{ page.purpose }}</td>
                <td class="guide-table__action">
                  <router-link :to="planningPath(page.path)">Öffnen</router-link>
                </td>
              </tr>
              <tr v-if="filteredPages.length === 0">
                <td colspan="3" class="guide-table__empty">Keine Seite gefunden.</td>
              </tr>
            </tbody>
          </table>
        </el-tab-pane>

        <el-tab-pane label="Begriffe" name="glossary">
          <el-input
            v-model="glossaryFilter"
            size="small"
            clearable
            placeholder="Begriff suchen…"
            class="help-search"
          />
          <dl class="glossary">
            <div v-for="item in filteredGlossary" :key="item.term" class="glossary__item">
              <dt>{{ item.term }}</dt>
              <dd>{{ item.def }}</dd>
            </div>
          </dl>
          <p v-if="filteredGlossary.length === 0" class="guide-table__empty">Kein Begriff gefunden.</p>
        </el-tab-pane>

        <el-tab-pane label="Details" name="details">
          <el-collapse v-model="openDetails" accordion>
            <el-collapse-item title="Prozess & Human-in-the-loop" name="process">
              <p class="detail-p" v-html="renderMd(process.intro)" />
              <p class="detail-p detail-p--highlight" v-html="renderMd(process.principle)" />
              <ul class="detail-list">
                <li v-for="(item, i) in process.context.items" :key="i" v-html="renderMd(item)" />
              </ul>
            </el-collapse-item>

            <el-collapse-item title="KI & Agenten" name="ai">
              <p class="detail-p" v-html="renderMd(ai.intro)" />
              <ul v-if="accessibleAiModules.length" class="detail-list">
                <li v-for="mod in accessibleAiModules" :key="mod.path + mod.name">
                  <router-link :to="planningPath(mod.path)">{{ mod.name }}</router-link>
                  — {{ mod.when }}
                </li>
              </ul>
              <p v-else class="hint">Keine KI-Module für Ihr Profil freigeschaltet.</p>
            </el-collapse-item>

            <el-collapse-item :title="rolesSectionTitle" name="roles">
              <template v-if="isPortalPlanning">
                <p class="detail-p">
                  Im Portal steuern Administrator und Ihr Benutzerprofil, welche Module sichtbar sind
                  (Administration → Benutzer &amp; Funktionen).
                </p>
                <ul class="detail-list">
                  <li v-for="group in pageGuideGroups" :key="group.group">
                    <strong>{{ group.group }}</strong> — {{ group.pages.length }}
                    {{ group.pages.length === 1 ? 'Modul' : 'Module' }}
                  </li>
                </ul>
              </template>
              <template v-else>
                <div v-for="r in roles" :key="r.role" class="role-row">
                  <el-tag size="small" effect="plain">{{ r.role }}</el-tag>
                  <span>{{ r.desc }}</span>
                </div>
                <p class="hint">Rolle im Header wechseln — Menü passt sich an.</p>
              </template>
            </el-collapse-item>

            <el-collapse-item v-if="!isPortalPlanning" title="Technik & API" name="tech">
              <ul class="detail-list">
                <li v-for="(hint, i) in techHints" :key="i">{{ hint }}</li>
              </ul>
            </el-collapse-item>
          </el-collapse>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  SYSTEM_SUMMARY,
  PLANNER_PROCESS,
  AI_OVERVIEW,
  DAILY_WORKFLOW,
  PAGE_GUIDE,
  ROLES_GUIDE,
  GLOSSARY,
  TECH_HINTS,
} from '@/utils/helpContent';
import {
  buildPortalWorkflow,
  buildPortalPageGuide,
  flattenPageGuide,
  filterAccessibleModules,
} from '@/utils/portalHelp';
import { usePlanningBasePath } from '@/composables/usePlanningBasePath';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from '@/composables/useI18n';

const { isPortalPlanning, path: planningPath } = usePlanningBasePath();
const auth = useAuthStore();
const { locale } = useI18n();

const summary = SYSTEM_SUMMARY;
const process = PLANNER_PROCESS;
const ai = AI_OVERVIEW;
const roles = ROLES_GUIDE;
const glossary = GLOSSARY;
const techHints = TECH_HINTS;

const activeTab = ref('pages');
const openDetails = ref('');
const pageFilter = ref('');
const glossaryFilter = ref('');

const pageSubtitle = computed(() =>
  isPortalPlanning.value
    ? 'Entspricht Ihrem Portal-Menü — nur freigeschaltete Module.'
    : 'Kurzüberblick — Start mit dem Tages-Wizard, Rest bei Bedarf in den Tabs.',
);

const workflowSteps = computed(() => {
  const portalSteps = buildPortalWorkflow(auth, locale.value);
  if (portalSteps.length) return portalSteps;
  return DAILY_WORKFLOW.map((s) => ({ ...s, label: s.title }));
});

const workflowTitle = computed(() => {
  const n = workflowSteps.value.length;
  return n ? `Ihr Tag in ${n} Schritten` : 'Planer-Workflow';
});

const pageGuideGroups = computed(() => {
  const portalGuide = buildPortalPageGuide(auth, locale.value);
  return portalGuide.length ? portalGuide : PAGE_GUIDE;
});

const allPages = computed(() => flattenPageGuide(pageGuideGroups.value));

const accessibleAiModules = computed(() => filterAccessibleModules(auth, ai.modules));

const rolesSectionTitle = computed(() =>
  isPortalPlanning.value ? 'Ihre Freigaben' : 'Rollen (Demo)',
);

const filteredPages = computed(() => {
  const q = pageFilter.value.trim().toLowerCase();
  if (!q) return allPages.value;
  return allPages.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.purpose.toLowerCase().includes(q) ||
      p.group.toLowerCase().includes(q),
  );
});

const filteredGlossary = computed(() => {
  const q = glossaryFilter.value.trim().toLowerCase();
  if (!q) return glossary;
  return glossary.filter(
    (g) => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q),
  );
});

function renderMd(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
</script>

<style scoped>
.help-view {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-hero {
  padding: 20px;
}

.help-hero__title {
  margin: 0 0 6px;
  font-size: var(--text-lg, 0.9375rem);
  font-weight: var(--font-weight-semibold, 600);
}

.help-hero__lead {
  margin: 0 0 14px;
  font-size: var(--text-md, 0.875rem);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.help-cta {
  display: inline-flex;
  align-items: center;
  padding: 8px 18px;
  border-radius: var(--radius, 6px);
  font-size: var(--text-sm, 0.75rem);
  font-weight: var(--font-weight-semibold, 600);
}

.help-cta--primary {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: var(--color-accent-on, #fff);
}

.help-cta--primary:hover {
  background: var(--color-accent-dark);
  border-color: var(--color-accent-dark);
  color: var(--color-accent-on, #fff);
}


/* 8-Schritte-Tabelle */
.steps-table__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.steps-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm, 0.75rem);
}

.steps-table td {
  padding: 9px 16px;
  border-bottom: 1px solid var(--color-border);
}

.steps-table tr:last-child td {
  border-bottom: none;
}

.steps-table__num {
  width: 32px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.steps-table__title {
  font-weight: 500;
}

.steps-table__label {
  font-weight: 400;
  color: var(--color-text-muted);
  font-size: var(--text-xs, 0.6875rem);
}

.tab-hint {
  margin: 0 0 10px;
  font-size: var(--text-xs, 0.6875rem);
  color: var(--color-text-muted);
}

.steps-table__action {
  width: 64px;
  text-align: right;
  white-space: nowrap;
}

/* Tabs */
.help-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
}

.help-tabs :deep(.el-tabs__content) {
  padding: 12px 16px 16px;
}

.help-search {
  max-width: 280px;
  margin-bottom: 12px;
}

.guide-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm, 0.75rem);
}

.guide-table th,
.guide-table td {
  text-align: left;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.guide-table th {
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: var(--text-xs, 0.6875rem);
}

.guide-table__action {
  width: 64px;
  text-align: right;
  white-space: nowrap;
}

.guide-table__empty {
  padding: 16px 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm, 0.75rem);
}

.glossary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 24px;
  margin: 0;
}

.glossary__item dt {
  font-weight: 600;
  font-size: var(--text-sm, 0.75rem);
  margin-bottom: 2px;
}

.glossary__item dd {
  margin: 0;
  font-size: var(--text-xs, 0.6875rem);
  color: var(--color-text-muted);
  line-height: 1.45;
}

.detail-p {
  margin: 0 0 10px;
  font-size: var(--text-sm, 0.75rem);
  line-height: 1.5;
}

.detail-p--highlight {
  padding: 8px 12px;
  background: var(--help-highlight, var(--blue-50, #eef2fd));
  border-radius: var(--radius, 6px);
}

.detail-list {
  margin: 0;
  padding-left: 18px;
  font-size: var(--text-sm, 0.75rem);
  line-height: 1.55;
}

.role-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 8px;
  font-size: var(--text-sm, 0.75rem);
}

.hint {
  margin: 10px 0 0;
  font-size: var(--text-xs, 0.6875rem);
  color: var(--color-text-muted);
}

@media (max-width: 600px) {
  .glossary {
    grid-template-columns: 1fr;
  }
}
</style>
