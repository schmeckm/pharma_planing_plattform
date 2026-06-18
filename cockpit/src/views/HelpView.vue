<template>
  <div class="help-view">
    <p class="page-subtitle">
      Was die Plattform macht, welche Seite wofür ist — und wo Sie im Alltag anfangen.
    </p>

    <div class="help-hero panel">
      <h2>{{ summary.title }}</h2>
      <p class="help-hero__sub">{{ summary.subtitle }}</p>
      <p v-for="(p, i) in summary.paragraphs" :key="i" class="help-hero__p" v-html="renderMd(p)" />
    </div>

    <section class="panel panel--ai">
      <div class="panel-header">
        <h2>{{ ai.title }}</h2>
        <router-link to="/wizard" class="workflow__link">→ KI starten (Tages-Wizard)</router-link>
      </div>
      <div class="panel-body">
        <p class="process-intro" v-html="renderMd(ai.intro)" />
        <p v-if="ai.dualMode" class="process-intro ai-dual-mode" v-html="renderMd(ai.dualMode)" />
        <p class="ai-architecture">{{ ai.architecture }}</p>

        <div class="ai-modules">
          <article v-for="mod in ai.modules" :key="mod.path + mod.name" class="ai-module">
            <div class="ai-module__head">
              <div>
                <strong>{{ mod.name }}</strong>
                <el-tag v-if="mod.edition" size="small" effect="plain" class="ai-tag">{{ mod.edition }}</el-tag>
              </div>
              <router-link :to="mod.path">Öffnen</router-link>
            </div>
            <p class="ai-module__when"><em>Wann:</em> {{ mod.when }}</p>
            <p class="ai-module__what">{{ mod.what }}</p>
            <ul v-if="mod.agents" class="ai-agents-list">
              <li v-for="a in mod.agents" :key="a">{{ a }}</li>
            </ul>
          </article>
        </div>

        <h3 class="ai-subtitle">Die vier KI-Agenten</h3>
        <div class="ai-agents-grid">
          <div v-for="agent in ai.agentsDetail" :key="agent.id" class="ai-agent-card">
            <strong>{{ agent.role }}</strong>
            <p>{{ agent.task }}</p>
          </div>
        </div>

        <h3 class="ai-subtitle">Kein LLM — aber trotzdem intelligent</h3>
        <ul class="tech-list">
          <li v-for="(item, i) in ai.notAi" :key="i" v-html="renderMd(item)" />
        </ul>
        <p class="hint">{{ ai.roadmap }}</p>
      </div>
    </section>

    <div class="help-grid">
      <section class="panel panel--process">
        <div class="panel-header">
          <h2>{{ process.title }}</h2>
          <router-link to="/wizard" class="workflow__link">→ Tages-Wizard starten</router-link>
        </div>
        <div class="panel-body">
          <p class="process-intro" v-html="renderMd(process.intro)" />
          <div class="process-context">
            <h3>{{ process.context.title }}</h3>
            <ul>
              <li v-for="(item, i) in process.context.items" :key="i" v-html="renderMd(item)" />
            </ul>
          </div>
          <p class="process-principle" v-html="renderMd(process.principle)" />

          <div class="process-steps">
            <article v-for="s in process.steps" :key="s.step" class="process-step">
              <div class="process-step__head">
                <span class="workflow__num">{{ s.step }}</span>
                <div>
                  <strong>{{ s.title }}</strong>
                  <span class="process-step__cockpit">{{ s.cockpit }}</span>
                </div>
                <router-link :to="s.path" class="workflow__link">Öffnen</router-link>
              </div>
              <dl class="process-step__detail">
                <div><dt>Rolle</dt><dd>{{ s.role }}</dd></div>
                <div><dt>Eingang</dt><dd>{{ s.input }}</dd></div>
                <div><dt>Aktivität</dt><dd>{{ s.activity }}</dd></div>
                <div><dt>Ergebnis</dt><dd>{{ s.output }}</dd></div>
              </dl>
            </article>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header"><h2>Typischer Tagesablauf (Kurz)</h2></div>
        <div class="panel-body">
          <ol class="workflow">
            <li v-for="step in workflow" :key="step.step">
              <div class="workflow__head">
                <span class="workflow__num">{{ step.step }}</span>
                <strong>{{ step.title }}</strong>
                <router-link :to="step.path" class="workflow__link">→ Seite öffnen</router-link>
              </div>
              <p>{{ step.text }}</p>
            </li>
          </ol>
        </div>
      </section>
    </div>

    <div class="help-grid help-grid--roles">
      <section class="panel">
        <div class="panel-header"><h2>{{ analytics.title }}</h2></div>
        <div class="panel-body">
          <p class="process-intro">{{ analytics.intro }}</p>
          <div v-for="item in analytics.available" :key="item.name" class="analytics-row">
            <div class="analytics-row__head">
              <strong>{{ item.name }}</strong>
              <el-tag size="small" type="success" effect="plain">{{ item.status }}</el-tag>
            </div>
            <p>{{ item.detail }}</p>
          </div>
          <h3 class="analytics-planned-title">Geplant (Roadmap Phase 4)</h3>
          <ul class="tech-list">
            <li v-for="(item, i) in analytics.planned" :key="i">{{ item }}</li>
          </ul>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header"><h2>Rollen (Demo)</h2></div>
        <div class="panel-body">
          <div v-for="r in roles" :key="r.role" class="role-row">
            <el-tag size="small" effect="plain">{{ r.role }}</el-tag>
            <span>{{ r.desc }}</span>
          </div>
          <p class="hint">Rolle oben rechts im Header wechseln — Menü und Buttons passen sich an.</p>
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-header"><h2>Alle Seiten im Überblick</h2></div>
      <div class="panel-body">
        <el-collapse v-model="openGroups">
          <el-collapse-item
            v-for="group in pageGuide"
            :key="group.group"
            :title="group.group"
            :name="group.group"
          >
            <table class="guide-table">
              <thead>
                <tr>
                  <th>Seite</th>
                  <th>Wofür?</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="page in group.pages" :key="page.path">
                  <td><strong>{{ page.name }}</strong></td>
                  <td>{{ page.purpose }}</td>
                  <td><router-link :to="page.path">Öffnen</router-link></td>
                </tr>
              </tbody>
            </table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Begriffe (Glossar)</h2></div>
      <div class="panel-body">
        <dl class="glossary">
          <div v-for="item in glossary" :key="item.term" class="glossary__item">
            <dt>{{ item.term }}</dt>
            <dd>{{ item.def }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="panel panel--muted">
      <div class="panel-header"><h2>Technik &amp; API</h2></div>
      <div class="panel-body">
        <ul class="tech-list">
          <li v-for="(hint, i) in techHints" :key="i">{{ hint }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  SYSTEM_SUMMARY,
  PLANNER_PROCESS,
  AI_OVERVIEW,
  ANALYTICS_OVERVIEW,
  DAILY_WORKFLOW,
  PAGE_GUIDE,
  ROLES_GUIDE,
  GLOSSARY,
  TECH_HINTS,
} from '@/utils/helpContent';

const summary = SYSTEM_SUMMARY;
const process = PLANNER_PROCESS;
const ai = AI_OVERVIEW;
const analytics = ANALYTICS_OVERVIEW;
const workflow = DAILY_WORKFLOW;
const pageGuide = PAGE_GUIDE;
const roles = ROLES_GUIDE;
const glossary = GLOSSARY;
const techHints = TECH_HINTS;
const openGroups = ref(['KI & Intelligence', 'Tägliche Planung', 'Enterprise 2.0']);

function renderMd(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
</script>

<style scoped>
.help-view {
  max-width: 1100px;
}

.help-hero__sub {
  color: var(--color-text-muted);
  margin: 0 0 12px;
  font-size: 0.9375rem;
}

.help-hero__p {
  margin: 0 0 10px;
  line-height: 1.55;
  font-size: 0.9375rem;
}

.help-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
  margin: 20px 0;
}

.help-grid--roles {
  grid-template-columns: 1.2fr 1fr;
}

.panel--ai {
  margin-bottom: 20px;
  border-left: 4px solid #7c3aed;
}

.ai-architecture {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-family: ui-monospace, monospace;
  margin: 0 0 16px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: var(--radius);
}

.ai-modules {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.ai-module {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 12px 14px;
  background: #fafbff;
}

.ai-module__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.ai-tag {
  margin-left: 8px;
  vertical-align: middle;
}

.ai-module__when {
  margin: 0 0 4px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.ai-module__what {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.ai-agents-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 0.75rem;
}

.ai-subtitle {
  margin: 20px 0 10px;
  font-size: 0.9375rem;
}

.ai-agents-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.ai-agent-card {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 0.8125rem;
  background: #fff;
}

.ai-agent-card strong {
  display: block;
  margin-bottom: 4px;
  color: var(--color-accent);
}

.ai-agent-card p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.panel--process {
  grid-column: 1 / -1;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.process-intro {
  margin: 0 0 16px;
  line-height: 1.55;
  font-size: 0.9375rem;
}

.process-context {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f5f8fb;
  border-radius: var(--radius);
  border-left: 3px solid var(--color-accent);
}

.process-context h3 {
  margin: 0 0 8px;
  font-size: 0.875rem;
}

.process-context ul {
  margin: 0;
  padding-left: 18px;
  font-size: 0.875rem;
  line-height: 1.55;
}

.process-principle {
  margin: 0 0 20px;
  padding: 10px 14px;
  background: #fff8e6;
  border-radius: var(--radius);
  font-size: 0.875rem;
  line-height: 1.5;
}

.process-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.process-step {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 14px 16px;
  background: #fff;
}

.process-step__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.process-step__cockpit {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 400;
  margin-top: 2px;
}

.process-step__detail {
  margin: 0;
  padding-left: 36px;
  display: grid;
  gap: 8px;
}

.process-step__detail div {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  font-size: 0.8125rem;
}

.process-step__detail dt {
  font-weight: 600;
  color: var(--color-text-muted);
}

.process-step__detail dd {
  margin: 0;
  line-height: 1.45;
}

.analytics-row {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}

.analytics-row:last-of-type {
  border-bottom: none;
}

.analytics-row__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.analytics-row p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.analytics-planned-title {
  margin: 16px 0 8px;
  font-size: 0.875rem;
}

.workflow {
  margin: 0;
  padding: 0;
  list-style: none;
}

.workflow li {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.workflow li:last-child {
  border-bottom: none;
}

.workflow__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.workflow__num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.workflow__link {
  margin-left: auto;
  font-size: 0.8125rem;
}

.workflow p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  padding-left: 34px;
}

.role-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
  font-size: 0.875rem;
}

.hint {
  margin-top: 16px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.guide-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.guide-table th,
.guide-table td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.guide-table th {
  font-weight: 600;
  background: #fafafa;
}

.glossary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.glossary__item dt {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 4px;
}

.glossary__item dd {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.tech-list {
  margin: 0;
  padding-left: 20px;
  font-size: 0.875rem;
  line-height: 1.7;
}

.panel--muted {
  background: #fafbfc;
}

@media (max-width: 900px) {
  .help-grid,
  .help-grid--roles {
    grid-template-columns: 1fr;
  }

  .ai-agents-grid {
    grid-template-columns: 1fr 1fr;
  }

  .process-step__detail div {
    grid-template-columns: 1fr;
  }
}
</style>
