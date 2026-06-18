<template>

  <div class="v2-page">

    <WizardReturnBar />

    <p class="page-subtitle">Review sequencing and allocation issues — comment, escalate, and resolve</p>



    <div class="toolbar">

      <Select v-model="sourceFilter" :options="sourceOptions" placeholder="All Sources" showClear class="w-10rem" />

      <Select v-model="statusFilter" :options="statusOptions" placeholder="All Statuses" showClear class="w-10rem" />

      <Button label="Refresh" icon="pi pi-refresh" text @click="load" />

    </div>



    <DataTable :value="filteredItems" stripedRows size="small" :loading="loading" @row-click="selectRow">

      <Column field="exceptionId" header="ID" />

      <Column header="Type">

        <template #body="{ data }">{{ exceptionLabel(data.typeLabel) }}</template>

      </Column>

      <Column field="packagingOrderId" header="Order" />

      <Column field="destinationCountry" header="Country" />

      <Column field="source" header="Source" />

      <Column header="Risk">

        <template #body="{ data }"><RiskBadge :level="data.riskLevel" :score="data.riskScore" /></template>

      </Column>

      <Column field="status" header="Status" />

      <Column field="severity" header="Severity" />

    </DataTable>



    <Card v-if="selected" class="detail-card">

      <template #title>{{ selected.exceptionId }} — {{ exceptionLabel(selected.typeLabel) }}</template>

      <template #content>

        <p>{{ plannerText(selected.message) }}</p>

        <div class="meta">

          <Tag :value="selected.status" />

          <Tag v-if="selected.source" :value="selected.source" severity="info" />

          <span v-if="selected.productionLine">Line: {{ selected.productionLine }}</span>

          <span v-if="selected.assignedTo">Assigned: {{ selected.assignedTo }}</span>

        </div>

        <Textarea

          v-if="selected.source !== 'SEQUENCING'"

          v-model="comment"

          rows="3"

          placeholder="Add comment…"

          class="w-full"

          :disabled="!canComment"

        />

        <div class="actions">

          <Button

            v-if="canComment && selected.source !== 'SEQUENCING'"

            label="Comment"

            icon="pi pi-comment"

            size="small"

            @click="addComment"

          />

          <Button

            v-if="canReview"

            label="Review"

            icon="pi pi-eye"

            severity="info"

            size="small"

            @click="review"

            :disabled="selected.status === 'RESOLVED' || selected.source === 'SEQUENCING'"

          />

          <Button

            v-if="canEscalate"

            label="Escalate"

            icon="pi pi-arrow-up"

            severity="warn"

            size="small"

            @click="escalate"

            :disabled="selected.status === 'RESOLVED' || selected.source === 'SEQUENCING'"

          />

          <Button

            v-if="canResolve"

            label="Resolve"

            icon="pi pi-check"

            severity="success"

            size="small"

            @click="resolve"

            :disabled="selected.status === 'RESOLVED' || selected.source === 'SEQUENCING'"

          />

          <Button

            v-if="selected.source === 'SEQUENCING'"

            label="Open Production Sequencing"

            icon="pi pi-sort"

            size="small"

            outlined

            @click="$router.push('/line-optimization')"

          />

        </div>

        <div v-for="c in selected.comments || []" :key="c.commentId" class="comment">

          {{ c.userName || c.userId }}: {{ c.text }}

        </div>

      </template>

    </Card>

  </div>

</template>



<script setup>

import { ref, computed, onMounted } from 'vue';

import DataTable from 'primevue/datatable';

import Column from 'primevue/column';

import Card from 'primevue/card';

import Button from 'primevue/button';

import Textarea from 'primevue/textarea';

import Select from 'primevue/select';

import Tag from 'primevue/tag';

import RiskBadge from '@/components/shared/RiskBadge.vue';
import WizardReturnBar from '@/components/wizard/WizardReturnBar.vue';

import { planningApi } from '@/api/planning';

import { useExceptionsStore } from '@/stores/exceptions';

import { useAuthStore } from '@/stores/auth';

import { exceptionLabel, plannerText } from '@/utils/plannerTerminology';



const allocStore = useExceptionsStore();

const auth = useAuthStore();

const items = ref([]);

const loading = ref(false);

const selected = ref(null);

const comment = ref('');

const statusFilter = ref(null);

const sourceFilter = ref(null);



const statusOptions = ['OPEN', 'IN_REVIEW', 'ESCALATED', 'RESOLVED'];

const sourceOptions = ['SEQUENCING', 'ALLOCATION'];



const canComment = computed(() => auth.hasPermission('exceptions:comment'));

const canEscalate = computed(() => auth.hasPermission('exceptions:escalate'));

const canResolve = computed(() => auth.hasPermission('exceptions:resolve'));

const canReview = computed(() => auth.hasPermission('exceptions:read'));



const filteredItems = computed(() => {

  let list = items.value;

  if (statusFilter.value) list = list.filter((i) => i.status === statusFilter.value);

  if (sourceFilter.value) list = list.filter((i) => i.source === sourceFilter.value);

  return list;

});



async function load() {

  loading.value = true;

  try {

    const planning = await planningApi.getExceptions({ status: statusFilter.value || undefined });

    items.value = planning.exceptions || [];

  } finally {

    loading.value = false;

  }

}



onMounted(load);



function selectRow(e) {

  selected.value = e.data;

}



async function addComment() {

  if (!comment.value || selected.value.source === 'SEQUENCING') return;

  await allocStore.addComment(selected.value.exceptionId, comment.value);

  await load();

  selected.value = items.value.find((i) => i.exceptionId === selected.value.exceptionId);

  comment.value = '';

}



async function review() {

  await allocStore.review(selected.value.exceptionId);

  await load();

  selected.value = items.value.find((i) => i.exceptionId === selected.value.exceptionId);

}



async function escalate() {

  await allocStore.escalate(selected.value.exceptionId, 'USR-SC01', 'Requires supply chain review');

  await load();

  selected.value = items.value.find((i) => i.exceptionId === selected.value.exceptionId);

}



async function resolve() {

  await allocStore.resolve(selected.value.exceptionId, 'Exception resolved after sequence adjustment');

  await load();

  selected.value = items.value.find((i) => i.exceptionId === selected.value.exceptionId);

}

</script>



<style scoped>

.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }

.w-10rem { width: 10rem; }

.detail-card { margin-top: 20px; }

.meta { display: flex; gap: 12px; align-items: center; margin: 8px 0; font-size: 0.8125rem; flex-wrap: wrap; }

.actions { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }

.comment { font-size: 0.8125rem; padding: 6px 0; border-bottom: 1px solid var(--color-border); }

.w-full { width: 100%; }

</style>

