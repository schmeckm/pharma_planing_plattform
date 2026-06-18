<template>

  <div>

    <p class="page-subtitle">System & Linien-Leistungsfaktoren</p>

    <el-tabs v-model="activeTab" class="admin-tabs">
      <el-tab-pane :label="t('admin.tabs.system')" name="system">
        <div class="admin-grid">

      <div class="panel panel--wide">
        <div class="panel-header">
          <h2>Leistungsgrad aus historischen Verpackungsaufträgen</h2>
          <div class="panel-header__actions">
            <el-button size="small" :loading="loadingAnalysis" @click="loadAnalysis">Analyse aktualisieren</el-button>
            <el-button v-if="canEdit" size="small" :loading="applyingShort" @click="applyFactors('short')">
              Kurzfrist übernehmen
            </el-button>
            <el-button v-if="canEdit" type="primary" size="small" :loading="applyingLong" @click="applyFactors('long')">
              Langfrist übernehmen
            </el-button>
          </div>
        </div>
        <div class="panel-body panel-body--flush">
          <p v-if="analysis" class="hint hint--top">
            {{ analysis.completedOrderCount }} abgeschlossene Aufträge analysiert
            (Referenz {{ analysis.referenceDate }}).
            Kurzfrist {{ analysis.horizons?.short?.days }} Tage · Langfrist {{ analysis.horizons?.long?.days }} Tage.
          </p>
          <el-table v-loading="loadingAnalysis" :data="analysis?.byLine || []" stripe size="small">
            <el-table-column prop="lineId" label="Linie" width="130" />
            <el-table-column prop="lineName" label="Name" min-width="160" show-overflow-tooltip />
            <el-table-column label="OEE kurz" width="100">
              <template #default="{ row }">{{ formatPct(row.shortTermOee) }}</template>
            </el-table-column>
            <el-table-column label="Faktor kurz" width="100">
              <template #default="{ row }">{{ formatFactor(row.shortTermFactor) }}</template>
            </el-table-column>
            <el-table-column label="Runs kurz" width="90" prop="historicalRunsShort" />
            <el-table-column label="OEE lang" width="100">
              <template #default="{ row }">{{ formatPct(row.longTermOee) }}</template>
            </el-table-column>
            <el-table-column label="Faktor lang" width="100">
              <template #default="{ row }">{{ formatFactor(row.longTermFactor) }}</template>
            </el-table-column>
            <el-table-column label="Runs lang" width="90" prop="historicalRunsLong" />
          </el-table>
          <p class="hint hint--foot">
            Kurzfrist ({{ analysis?.horizons?.short?.days ?? 30 }} Tage) steuert Tagesplanung und Sequenzierung.
            Langfrist ({{ analysis?.horizons?.long?.days ?? 365 }} Tage) steuert Kapazitäts- und Programmplanung.
          </p>
        </div>
      </div>

      <div class="panel panel--wide">

        <div class="panel-header">

          <h2>Leistungsfaktor pro Linie</h2>

          <el-button size="small" :loading="loadingFactors" @click="loadFactors">Aktualisieren</el-button>

        </div>

        <div class="panel-body panel-body--flush">

          <p class="hint hint--top">

            Faktor 1,0 = Normal. Reduziert erhöht Laufzeiten in der Planung (0,5–1,5).

          </p>

          <el-table v-loading="loadingFactors" :data="lineFactors" stripe size="small">

            <el-table-column prop="lineId" label="Linie" width="130" />

            <el-table-column prop="lineName" label="Name" min-width="180" show-overflow-tooltip />

            <el-table-column label="Faktor" width="120">

              <template #default="{ row }">

                <el-input-number

                  v-model="row.performanceFactor"

                  :min="0.5"

                  :max="1.5"

                  :step="0.05"

                  :precision="2"

                  size="small"

                  controls-position="right"

                  :disabled="!canEdit"

                />

              </template>

            </el-table-column>

            <el-table-column prop="performanceFactorReason" label="Grund" min-width="160" show-overflow-tooltip />
            <el-table-column label="OEE lang" width="90">
              <template #default="{ row }">{{ formatPct(row.derivedLongTermOee) }}</template>
            </el-table-column>
            <el-table-column label="Abgeleitet" width="100">
              <template #default="{ row }">{{ formatFactor(row.derivedLongTermFactor) }}</template>
            </el-table-column>

            <el-table-column label="" width="100" fixed="right">

              <template #default="{ row }">

                <el-button

                  v-if="canEdit"

                  type="primary"

                  size="small"

                  link

                  :loading="savingLine === row.lineId"

                  @click="saveFactor(row)"

                >

                  Speichern

                </el-button>

              </template>

            </el-table-column>

          </el-table>

        </div>

      </div>



      <div class="panel">

        <div class="panel-header"><h2>Datenquelle</h2></div>

        <div class="panel-body">

          <div class="detail-row">

            <span class="detail-row__label">Modus</span>

            <span class="detail-row__value">

              <el-tag :type="appStore.useMockData ? 'warning' : 'success'" size="small">

                {{ appStore.dataSourceLabel }}

              </el-tag>

            </span>

          </div>

          <div class="detail-row">

            <span class="detail-row__label">API</span>

            <span class="detail-row__value">{{ apiBase }}</span>

          </div>

        </div>

      </div>



      <div class="panel">

        <div class="panel-header"><h2>Anwendung</h2></div>

        <div class="panel-body">

          <div class="detail-row">

            <span class="detail-row__label">Edition</span>

            <span class="detail-row__value">MVP 2.0 Enterprise</span>

          </div>

          <div class="detail-row">

            <span class="detail-row__label">Stack</span>

            <span class="detail-row__value">Vue 3 · Node.js API</span>

          </div>

        </div>

      </div>

    </div>
      </el-tab-pane>

      <el-tab-pane v-if="canManageUsers" :label="t('admin.tabs.userFeatures')" name="users">
        <div class="panel panel--wide admin-users-panel">
          <AdminUserFeaturesPanel />
        </div>
      </el-tab-pane>
    </el-tabs>

  </div>

</template>



<script setup>

import { ref, computed, onMounted } from 'vue';

import { ElMessage } from 'element-plus';

import { useAppStore } from '@/stores/app';

import { useAuthStore } from '@/stores/auth';

import { useI18n } from '@/composables/useI18n';

import { fetchLineFactors, updateLineFactor, fetchHistoricalAnalysis, applyDerivedFactors } from '@/api/performance';

import AdminUserFeaturesPanel from '@/components/admin/AdminUserFeaturesPanel.vue';

const appStore = useAppStore();
const auth = useAuthStore();
const { t } = useI18n();
const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const activeTab = ref('system');

const lineFactors = ref([]);
const analysis = ref(null);
const loadingFactors = ref(false);
const loadingAnalysis = ref(false);
const applyingShort = ref(false);
const applyingLong = ref(false);
const savingLine = ref(null);

const canEdit = computed(() => auth.hasPermission('rules:write') || auth.role === 'ADMIN' || auth.role === 'PLANNER');
const canManageUsers = computed(() => auth.hasPermission('users:manage'));

function formatPct(v) {
  return v == null ? '—' : `${v}%`;
}

function formatFactor(v) {
  return v == null ? '—' : Number(v).toFixed(2);
}

async function loadAnalysis() {
  loadingAnalysis.value = true;
  try {
    analysis.value = await fetchHistoricalAnalysis();
  } catch (err) {
    ElMessage.error(err.message || 'Historische Analyse nicht geladen');
  } finally {
    loadingAnalysis.value = false;
  }
}

async function applyFactors(horizon) {
  const loading = horizon === 'short' ? applyingShort : applyingLong;
  loading.value = true;
  try {
    const result = await applyDerivedFactors(horizon);
    ElMessage.success(`${result.applied} Linien (${horizon === 'short' ? 'Kurzfrist' : 'Langfrist'}) übernommen`);
    await Promise.all([loadFactors(), loadAnalysis()]);
  } catch (err) {
    ElMessage.error(err.message || 'Übernahme fehlgeschlagen');
  } finally {
    loading.value = false;
  }
}



async function loadFactors() {

  loadingFactors.value = true;

  try {

    const data = await fetchLineFactors();

    lineFactors.value = (data.items || []).map((l) => ({ ...l }));

  } catch (err) {

    ElMessage.error(err.message || 'Leistungsfaktoren nicht geladen');

  } finally {

    loadingFactors.value = false;

  }

}



async function saveFactor(row) {

  savingLine.value = row.lineId;

  try {

    await updateLineFactor(row.lineId, {

      performanceFactor: row.performanceFactor,

      reason: row.performanceFactorReason || 'Anpassung Administration',

      userId: auth.user?.userId || 'ADMIN',

    });

    ElMessage.success(`${row.lineId} gespeichert`);

    await loadFactors();

  } catch (err) {

    ElMessage.error(err.message || 'Speichern fehlgeschlagen');

  } finally {

    savingLine.value = null;

  }

}



onMounted(() => {
  loadFactors();
  loadAnalysis();
});

</script>



<style scoped>

.admin-grid {

  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 20px;

}



.panel--wide {

  grid-column: 1 / -1;

}



.panel-body--flush {

  padding: 0 0 12px;

}



.hint {

  font-size: 0.8125rem;

  color: var(--color-text-muted);

}



.hint--foot {
  padding: 8px 16px 0;
  margin: 0;
}

.panel-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-tabs {
  margin-top: 8px;
}

.admin-users-panel {
  margin-top: 0;
}



@media (max-width: 900px) {

  .admin-grid {

    grid-template-columns: 1fr;

  }

}

</style>


