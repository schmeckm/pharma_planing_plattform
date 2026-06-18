<template>

  <div class="v2-page">

    <WizardReturnBar />

    <p class="page-subtitle">Background mass allocation for daily and weekly demand runs</p>



    <Card class="job-form">

      <template #title>Start Mass Allocation Job</template>

      <template #content>

        <div class="form-row">

          <Select v-model="period" :options="periods" placeholder="Period" class="w-10rem" />

          <ToggleSwitch v-model="execute" />

          <label>Execute (not simulate)</label>

          <Button v-if="canCreate" label="Start Job" icon="pi pi-play" @click="start" :loading="starting" />

        </div>

      </template>

    </Card>



    <ProgressBar v-if="jobsStore.currentJob" :value="jobsStore.currentJob.progress" class="progress" />



    <Card v-if="jobsStore.currentJob">

      <template #title>Job {{ jobsStore.currentJob.jobId }}</template>

      <template #content>

        <div class="job-meta">

          <span>Status: <Tag :value="jobsStore.currentJob.status" /></span>

          <span>Period: {{ jobsStore.currentJob.period }}</span>

          <span>Progress: {{ jobsStore.currentJob.processedItems }}/{{ jobsStore.currentJob.totalItems }}</span>

          <span>Success: {{ jobsStore.currentJob.successful }}</span>

          <span>Failed: {{ jobsStore.currentJob.failed }}</span>

        </div>

      </template>

    </Card>



    <DataTable :value="jobsStore.jobs" stripedRows size="small" class="mt-4" @row-click="selectJob">

      <Column field="jobId" header="Job ID" />

      <Column field="period" header="Period" />

      <Column field="status" header="Status" />

      <Column field="progress" header="Progress %" />

      <Column field="successful" header="OK" />

      <Column field="failed" header="Failed" />

      <Column field="createdAt" header="Created" />

    </DataTable>



    <Card v-if="selectedJob?.results?.length" class="mt-4">

      <template #title>Result History — {{ selectedJob.jobId }}</template>

      <template #content>

        <DataTable :value="selectedJob.results" size="small" stripedRows>

          <Column field="packagingOrderId" header="Order" />

          <Column field="status" header="Status" />

          <Column field="recommendedBatchId" header="Batch">

            <template #body="{ data }">{{ data.recommendedBatchId || '—' }}</template>

          </Column>

          <Column header="Risk">

            <template #body="{ data }">

              <RiskBadge v-if="data.risk" :level="data.risk.level" :score="data.risk.score" />

              <span v-else>—</span>

            </template>

          </Column>

          <Column header="Failures">

            <template #body="{ data }">{{ data.failureReasons?.length || 0 }}</template>

          </Column>

        </DataTable>

      </template>

    </Card>

  </div>

</template>



<script setup>

import { ref, computed, onMounted, onUnmounted } from 'vue';

import Card from 'primevue/card';

import Button from 'primevue/button';

import Select from 'primevue/select';

import ToggleSwitch from 'primevue/toggleswitch';

import ProgressBar from 'primevue/progressbar';

import DataTable from 'primevue/datatable';

import Column from 'primevue/column';

import Tag from 'primevue/tag';

import RiskBadge from '@/components/shared/RiskBadge.vue';
import WizardReturnBar from '@/components/wizard/WizardReturnBar.vue';

import { useJobsStore } from '@/stores/jobs';

import { useAuthStore } from '@/stores/auth';



const jobsStore = useJobsStore();

const auth = useAuthStore();

const period = ref('DAILY');

const periods = ['DAILY', 'WEEKLY'];

const execute = ref(false);

const starting = ref(false);

const selectedJob = ref(null);



const canCreate = computed(() => auth.hasPermission('jobs:create'));



onMounted(() => jobsStore.loadJobs());

onUnmounted(() => jobsStore.stopPolling());



async function start() {

  starting.value = true;

  try {

    await jobsStore.startMassJob({ period: period.value, execute: execute.value });

  } finally {

    starting.value = false;

  }

}



function selectJob(e) {

  selectedJob.value = e.data;

}

</script>



<style scoped>

.form-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.w-10rem { width: 10rem; }

.progress { margin: 16px 0; height: 8px; }

.job-meta { display: flex; gap: 20px; flex-wrap: wrap; font-size: 0.875rem; }

.mt-4 { margin-top: 20px; }

</style>

