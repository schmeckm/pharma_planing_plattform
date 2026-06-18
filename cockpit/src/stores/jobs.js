import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiV2 } from '@/api/v2';

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref([]);
  const currentJob = ref(null);
  const polling = ref(null);

  async function loadJobs() {
    jobs.value = await apiV2.getJobs();
  }

  async function startMassJob(payload) {
    const job = await apiV2.createMassJob(payload);
    jobs.value.unshift(job);
    pollJob(job.jobId);
    return job;
  }

  async function pollJob(jobId) {
    currentJob.value = await apiV2.getJob(jobId);
    if (currentJob.value.status === 'RUNNING' || currentJob.value.status === 'QUEUED') {
      polling.value = setTimeout(() => pollJob(jobId), 1000);
    } else {
      clearTimeout(polling.value);
      await loadJobs();
    }
  }

  function stopPolling() {
    clearTimeout(polling.value);
  }

  return { jobs, currentJob, loadJobs, startMassJob, pollJob, stopPolling };
});
