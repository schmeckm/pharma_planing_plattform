import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchOrders, fetchBatches, fetchRules, fetchAuditTrail, fetchDashboard } from '@/api';
import { useAppStore } from './app';

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref([]);
  const batches = ref([]);
  const rules = ref({ countryRules: [], ruleDefinitions: [] });
  const auditTrail = ref([]);
  const dashboard = ref(null);

  const app = useAppStore();

  async function loadOrders(params = {}) {
    return app.withLoading(async () => {
      orders.value = await fetchOrders(params);
    });
  }

  async function loadBatches(params = {}) {
    return app.withLoading(async () => {
      batches.value = await fetchBatches(params);
    });
  }

  async function loadRules() {
    return app.withLoading(async () => {
      rules.value = await fetchRules();
    });
  }

  async function loadAuditTrail(params = {}) {
    return app.withLoading(async () => {
      const result = await fetchAuditTrail(params);
      auditTrail.value = result.entries;
      return result;
    });
  }

  async function loadDashboard() {
    return app.withLoading(async () => {
      dashboard.value = await fetchDashboard();
    });
  }

  function getOrderById(id) {
    return orders.value.find((o) => o.packagingOrderId === id);
  }

  function getCountryRule(countryCode) {
    return rules.value.countryRules?.find((r) => r.countryCode === countryCode);
  }

  function getBatchById(batchId) {
    return batches.value.find((b) => b.batchId === batchId);
  }

  function clearOrderAllocations(orderIds = []) {
    const ids = new Set(orderIds);
    if (!ids.size) return;
    orders.value = orders.value.map((o) =>
      ids.has(o.packagingOrderId)
        ? { ...o, status: 'PLANNED', allocatedBatchId: null, allocatedQuantity: null }
        : o,
    );
  }

  return {
    orders,
    batches,
    rules,
    auditTrail,
    dashboard,
    loadOrders,
    loadBatches,
    loadRules,
    loadAuditTrail,
    loadDashboard,
    getOrderById,
    getCountryRule,
    getBatchById,
    clearOrderAllocations,
  };
});
