import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  simulateAllocation,
  executeAllocation,
  massSimulate,
  releaseAllocation,
  massRelease,
  fetchAuditTrail,
} from '@/api';
import { auditEntryToSimulationResult, allGatesPassed } from '@/utils/simulationResult';
import { useAppStore } from './app';
import { useOrdersStore } from './orders';

export const useSimulationStore = defineStore('simulation', () => {
  const selectedOrderId = ref(null);
  const simulationResult = ref(null);
  const massResult = ref(null);
  const recommendations = ref([]);
  const resultByOrderId = ref({});
  const panelOpen = ref(false);

  const app = useAppStore();
  const ordersStore = useOrdersStore();

  const selectedOrder = computed(() =>
    ordersStore.getOrderById(selectedOrderId.value)
  );

  const countryRule = computed(() => {
    if (!selectedOrder.value) return null;
    return ordersStore.getCountryRule(selectedOrder.value.destinationCountry);
  });

  const recommendedBatch = computed(() => {
    const batchId = simulationResult.value?.recommendedBatchId;
    return batchId ? ordersStore.getBatchById(batchId) : null;
  });

  function cacheSimulationResult(result) {
    const orderId = result?.packagingOrderId;
    if (!orderId) return;
    resultByOrderId.value = { ...resultByOrderId.value, [orderId]: result };
  }

  function selectOrder(orderId) {
    selectedOrderId.value = orderId;
    panelOpen.value = true;
    simulationResult.value = resultByOrderId.value[orderId] || null;
  }

  async function openOrderDetail(orderId) {
    if (!orderId) return;
    selectedOrderId.value = orderId;
    panelOpen.value = true;

    if (resultByOrderId.value[orderId]) {
      simulationResult.value = resultByOrderId.value[orderId];
      return simulationResult.value;
    }

    const fromMass = massResult.value?.results?.find((r) => r.packagingOrderId === orderId);
    if (fromMass?.ruleChecks?.length || fromMass?.recommendedBatchId) {
      simulationResult.value = fromMass;
      cacheSimulationResult(fromMass);
      return fromMass;
    }

    return app.withLoading(async () => {
      const audit = await fetchAuditTrail({ packagingOrderId: orderId, limit: 10 });
      const latest = (audit.entries || []).find((e) =>
        ['SIMULATED', 'SUCCESS', 'FAILED', 'ALLOCATED'].includes(e.status),
      );
      if (latest) {
        simulationResult.value = auditEntryToSimulationResult(latest);
        cacheSimulationResult(simulationResult.value);
        return simulationResult.value;
      }
      simulationResult.value = null;
      return null;
    });
  }

  function closePanel() {
    panelOpen.value = false;
  }

  async function runSimulation(orderId = selectedOrderId.value) {
    if (!orderId) return;
    return app.withLoading(async () => {
      simulationResult.value = await simulateAllocation(orderId);
      selectedOrderId.value = orderId;
      panelOpen.value = true;
      cacheSimulationResult(simulationResult.value);
      upsertRecommendation(simulationResult.value, ordersStore.getOrderById(orderId));
      await ordersStore.loadDashboard();
      return simulationResult.value;
    });
  }

  async function runExecute(orderId = selectedOrderId.value) {
    if (!orderId) return;
    if (!allGatesPassed(simulationResult.value)) {
      ElMessage.warning('Allocation blocked — one or more gates failed. Run Simulate again.');
      return;
    }
    return app.withLoading(async () => {
      const result = await executeAllocation(orderId);
      simulationResult.value = result;
      cacheSimulationResult(result);
      if (result.status === 'FAILED') {
        ElMessage.warning(
          result.failureReasons?.[0]
            || 'Allocation blocked — inventory or rules changed since simulation. Run Simulate again.',
        );
      }
      await ordersStore.loadOrders();
      await ordersStore.loadBatches();
      await ordersStore.loadAuditTrail();
      return result;
    });
  }

  async function runMassSimulation(payload = {}) {
    return app.withLoading(async () => {
      let packagingOrderIds = payload.packagingOrderIds;
      if (!packagingOrderIds?.length) {
        packagingOrderIds = ordersStore.orders
          .filter((o) => ['PLANNED', 'OPEN', 'SIMULATED'].includes(o.status))
          .slice(0, 15)
          .map((o) => o.packagingOrderId);
      }
      massResult.value = await massSimulate({ ...payload, packagingOrderIds });
      for (const r of massResult.value.results) {
        cacheSimulationResult(r);
      }
      recommendations.value = massResult.value.results.map((r) =>
        buildRecommendationEntry(r, ordersStore.getOrderById(r.packagingOrderId))
      );
      await ordersStore.loadDashboard();
      return massResult.value;
    });
  }

  function buildRecommendationEntry(result, order) {
    const packagingOrderId = result.packagingOrderId || order?.packagingOrderId;
    const batchId = result.recommendedBatchId || order?.allocatedBatchId || null;
    const batch = batchId ? ordersStore.getBatchById(batchId) : null;
    return {
      packagingOrderId,
      destinationCountry: order?.destinationCountry,
      materialNumber: order?.materialNumber,
      materialDescription: order?.materialDescription,
      packagingMaterialNumbers: order?.packagingMaterialNumbers,
      quantity: result.allocatedQuantity ?? order?.quantity,
      recommendedBatchId: batchId,
      batchMaterialNumber: batch?.materialNumber,
      status: result.status,
      failureReasons: result.failureReasons || [],
      ruleChecks: result.ruleChecks || [],
      rmsl: batch?.remainingShelfLifeMonths,
    };
  }

  function upsertRecommendation(result, order) {
    const packagingOrderId = result.packagingOrderId || order?.packagingOrderId;
    if (!packagingOrderId) return;
    const idx = recommendations.value.findIndex(
      (r) => r.packagingOrderId === packagingOrderId
    );
    const entry = buildRecommendationEntry(result, order);
    if (idx >= 0) recommendations.value[idx] = entry;
    else recommendations.value.push(entry);
  }

  function removeRecommendation(packagingOrderId) {
    recommendations.value = recommendations.value.filter(
      (r) => r.packagingOrderId !== packagingOrderId,
    );
    if (resultByOrderId.value[packagingOrderId]) {
      const next = { ...resultByOrderId.value };
      delete next[packagingOrderId];
      resultByOrderId.value = next;
    }
    if (simulationResult.value?.packagingOrderId === packagingOrderId) {
      simulationResult.value = null;
    }
  }

  function clearLocalAssignments(orderIds = []) {
    const ids = [...new Set(orderIds.filter(Boolean))];
    for (const id of ids) {
      removeRecommendation(id);
    }
    ordersStore.clearOrderAllocations(ids);
  }

  async function runAllocate(orderId = selectedOrderId.value, batchId = null) {
    if (!orderId) return;
    const cached = simulationResult.value?.packagingOrderId === orderId
      ? simulationResult.value
      : resultByOrderId.value[orderId];
    const rec = recommendations.value.find((r) => r.packagingOrderId === orderId);
    const gateResult = cached || rec;
    if (!allGatesPassed(gateResult)) {
      ElMessage.warning('Allocation blocked — run Simulate and ensure all gates pass first.');
      return;
    }
    return app.withLoading(async () => {
      const result = await executeAllocation(orderId);
      await ordersStore.loadOrders();
      await ordersStore.loadBatches();
      const order = ordersStore.getOrderById(orderId);
      if (result.status === 'FAILED') {
        ElMessage.warning(
          result.failureReasons?.[0]
            || 'Allocation blocked — inventory or rules changed. Re-simulate.',
        );
      }
      upsertRecommendation(result, order);
      cacheSimulationResult(result);
      if (selectedOrderId.value === orderId) {
        simulationResult.value = result;
      }
      await ordersStore.loadAuditTrail();
      return result;
    });
  }

  async function runMassAllocate(payload = {}) {
    return app.withLoading(async () => {
      let packagingOrderIds = payload.packagingOrderIds;
      if (!packagingOrderIds?.length) {
        packagingOrderIds = recommendations.value
          .filter((r) => r.recommendedBatchId && r.status === 'SIMULATED')
          .map((r) => r.packagingOrderId);
      }
      const results = [];
      for (const id of packagingOrderIds.slice(0, 15)) {
        try {
          const result = await executeAllocation(id);
          results.push({ id, result });
        } catch (err) {
          results.push({
            id,
            result: {
              packagingOrderId: id,
              status: 'FAILED',
              failureReasons: [err.message],
            },
          });
        }
      }
      await ordersStore.loadOrders();
      await ordersStore.loadBatches();
      for (const { id, result } of results) {
        upsertRecommendation(result, ordersStore.getOrderById(id));
        cacheSimulationResult(result);
      }
      await ordersStore.loadAuditTrail();
      return {
        totalOrders: results.length,
        successful: results.filter(({ result }) => result.status === 'SUCCESS').length,
        failed: results.filter(({ result }) => result.status === 'FAILED').length,
        results: results.map(({ result }) => result),
      };
    });
  }

  async function runUnallocate(orderId = selectedOrderId.value) {
    if (!orderId) return;
    return app.withLoading(async () => {
      const result = await releaseAllocation(orderId);
      clearLocalAssignments([orderId]);
      await ordersStore.loadOrders();
      await ordersStore.loadBatches();
      await ordersStore.loadAuditTrail();
      return result;
    });
  }

  async function runMassUnallocate(payload = {}) {
    return app.withLoading(async () => {
      let packagingOrderIds = payload.packagingOrderIds;
      if (!packagingOrderIds?.length) {
        packagingOrderIds = recommendations.value
          .filter((r) => ['SIMULATED', 'SUCCESS', 'ALLOCATED', 'PARTIALLY_ALLOCATED'].includes(r.status))
          .map((r) => r.packagingOrderId);
      }
      const targetIds = packagingOrderIds.slice(0, 15);
      const result = await massRelease({ ...payload, packagingOrderIds: targetIds });
      clearLocalAssignments(targetIds);
      await ordersStore.loadOrders();
      await ordersStore.loadBatches();
      await ordersStore.loadAuditTrail();
      return result;
    });
  }

  function setRecommendations(items) {
    recommendations.value = items || [];
  }

  return {
    selectedOrderId,
    simulationResult,
    massResult,
    recommendations,
    panelOpen,
    selectedOrder,
    countryRule,
    recommendedBatch,
    selectOrder,
    openOrderDetail,
    closePanel,
    runSimulation,
    runExecute,
    runMassSimulation,
    runAllocate,
    runMassAllocate,
    runUnallocate,
    runMassUnallocate,
    setRecommendations,
  };
});
