import client from './client';
import {
  mockOrders,
  mockBatches,
  mockRules,
  mockAuditTrail,
  mockDashboard,
  mockSimulationRecommendations,
  mockSimulationResult,
} from '@/mock/data';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';

/** In-memory mock assignments cleared on release (mock API has no backend persistence). */
const mockOrderAssignments = new Map();

function applyMockOrderAssignments(orders) {
  return orders.map((order) => {
    const patch = mockOrderAssignments.get(order.packagingOrderId);
    return patch ? { ...order, ...patch } : order;
  });
}

function delay(data, ms = 200) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function fetchOrders(params = {}) {
  if (useMock) {
    let orders = applyMockOrderAssignments([...mockOrders]);
    if (params.status) orders = orders.filter((o) => o.status === params.status);
    if (params.country) orders = orders.filter((o) => o.destinationCountry === params.country);
    return delay(orders);
  }
  const { data } = await client.get('/orders', { params });
  return data;
}

export async function fetchBatches(params = {}) {
  if (useMock) {
    let batches = [...mockBatches];
    if (params.materialNumber) {
      batches = batches.filter((b) => b.materialNumber === params.materialNumber);
    }
    if (params.qualityStatus) {
      batches = batches.filter((b) => b.qualityStatus === params.qualityStatus);
    }
    return delay(batches);
  }
  const { data } = await client.get('/batches', { params });
  return data;
}

export async function fetchRules() {
  if (useMock) return delay({ ...mockRules });
  const { data } = await client.get('/rules');
  return data;
}

export async function updateRules(payload) {
  if (useMock) {
    if (payload.countryCode) {
      const rule = mockRules.countryRules.find((r) => r.countryCode === payload.countryCode);
      if (rule) Object.assign(rule, payload);
      return delay(rule);
    }
    if (payload.ruleId) {
      const def = mockRules.ruleDefinitions?.find((r) => r.ruleId === payload.ruleId);
      if (def) Object.assign(def, payload);
      return delay(def);
    }
    return delay(mockRules);
  }
  const { data } = await client.put('/rules', payload);
  return data;
}

export async function createRuleDefinition(payload) {
  if (useMock) return delay({ ruleId: 'RULE-NEW', ...payload });
  const { data } = await client.post('/rules/definitions', payload);
  return data;
}

export async function updateRuleDefinition(ruleId, payload) {
  if (useMock) return delay({ ruleId, ...payload });
  const { data } = await client.put(`/rules/definitions/${ruleId}`, payload);
  return data;
}

export async function deleteRuleDefinition(ruleId) {
  if (useMock) return delay({ ruleId, deleted: true });
  const { data } = await client.delete(`/rules/definitions/${ruleId}`);
  return data;
}

export async function fetchRuleIntegration(ruleId) {
  if (useMock) return delay(null);
  try {
    const { data } = await client.get(`/rules/integrations/${ruleId}`);
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function saveRuleIntegration(ruleId, payload) {
  if (useMock) return delay({ ruleId, ...payload });
  const { data } = await client.put(`/rules/integrations/${ruleId}`, payload);
  return data;
}

export async function testRuleIntegration(ruleId, context = {}) {
  if (useMock) return delay({ ruleId, ok: true, passed: true, url: 'mock://test' });
  const { data } = await client.post(`/rules/integrations/${ruleId}/test`, { context });
  return data;
}

export async function fetchAuditTrail(params = {}) {
  if (useMock) {
    let entries = [...mockAuditTrail];
    if (params.packagingOrderId) {
      entries = entries.filter((e) => e.packagingOrderId === params.packagingOrderId);
    }
    if (params.status) entries = entries.filter((e) => e.status === params.status);
    return delay({ total: entries.length, entries });
  }
  const { data } = await client.get('/audit-trail', { params });
  return data;
}

export async function fetchDashboard() {
  if (useMock) {
    return delay({
      ...mockDashboard,
      recommendations: mockSimulationRecommendations,
    });
  }
  const [dashboardRes, orders, batches, audit] = await Promise.all([
    client.get('/dashboard'),
    client.get('/orders'),
    client.get('/batches'),
    client.get('/audit-trail', { params: { limit: 500 } }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const auditEntries = audit.data.entries || [];
  const orderById = Object.fromEntries(orders.data.map((o) => [o.packagingOrderId, o]));
  const batchById = Object.fromEntries(batches.data.map((b) => [b.batchId, b]));
  const latestByOrder = new Map();
  for (const e of auditEntries) {
    if (!['SIMULATED', 'SUCCESS', 'FAILED', 'RELEASED'].includes(e.status)) continue;
    const existing = latestByOrder.get(e.packagingOrderId);
    if (!existing || (e.timestamp || '') >= (existing.timestamp || '')) {
      latestByOrder.set(e.packagingOrderId, e);
    }
  }

  const clientOpenOrders = orders.data.filter((o) => ['PLANNED', 'OPEN'].includes(o.status)).length;
  const clientSimulatedOrders = [...latestByOrder.values()].filter((e) => e.status === 'SIMULATED').length;
  const clientAllocationsToday = auditEntries.filter(
    (e) => e.status === 'SUCCESS' && e.timestamp?.startsWith(today),
  ).length;
  const clientBlockedOrders =
    orders.data.filter((o) => o.status === 'BLOCKED').length
    + [...latestByOrder.values()].filter((e) => e.status === 'FAILED').length;
  const avgRmsl =
    batches.data.length > 0
      ? batches.data.reduce((sum, b) => sum + (b.remainingShelfLifeMonths || 0), 0) /
        batches.data.length
      : 0;

  function enrichRecommendation(entry, orderByIdMap, batchByIdMap) {
    const order = orderByIdMap[entry.packagingOrderId];
    const batch = batchByIdMap[entry.batchId];
    return {
      packagingOrderId: entry.packagingOrderId,
      destinationCountry: entry.destinationCountry || order?.destinationCountry,
      materialNumber: order?.materialNumber,
      materialDescription: order?.materialDescription,
      packagingMaterialNumbers: order?.packagingMaterialNumbers,
      recommendedBatchId: entry.batchId,
      batchMaterialNumber: batch?.materialNumber,
      status: entry.status,
      quantity: entry.allocatedQuantity ?? order?.quantity,
      timestamp: entry.timestamp,
      failureReasons: entry.failureReasons || [],
      ruleChecks: entry.ruleChecks || [],
    };
  }

  const simRecommendations = [...latestByOrder.values()].filter(
    (e) => ['SIMULATED', 'SUCCESS', 'FAILED'].includes(e.status),
  );

  const availableBatches =
    dashboardRes.data.availableBatches
    ?? batches.data.filter(
      (b) => b.qualityStatus === 'RELEASED' && (b.availableQuantity ?? 0) > 0,
    ).length;

  const stats = dashboardRes.data || {};

  return {
    // Prefer backend stats (full audit scan); client counts are fallback only.
    openOrders: stats.openOrders ?? clientOpenOrders,
    simulatedOrders: stats.simulatedOrders ?? clientSimulatedOrders,
    allocationsToday: stats.allocationsToday ?? clientAllocationsToday,
    blockedOrders: stats.blockedOrders ?? clientBlockedOrders,
    availableBatches,
    averageRmsl: stats.averageRmsl ?? Math.round(avgRmsl * 10) / 10,
    recommendations: simRecommendations
      .slice(0, 10)
      .map((e) => enrichRecommendation(e, orderById, batchById)),
  };
}

export async function simulateAllocation(packagingOrderId, userId = 'COCKPIT-USER') {
  if (useMock) {
    const order = mockOrders.find((o) => o.packagingOrderId === packagingOrderId);
    const rec = mockSimulationRecommendations.find((r) => r.packagingOrderId === packagingOrderId);
    const recommendedBatchId = rec?.recommendedBatchId || 'BATCH-DE-001';
    mockOrderAssignments.delete(packagingOrderId);
    return delay({
      ...mockSimulationResult,
      packagingOrderId,
      recommendedBatchId,
      allocatedQuantity: order?.quantity || 5000,
    });
  }
  const { data } = await client.post('/allocation/simulate', { packagingOrderId, userId });
  return data;
}

export async function executeAllocation(packagingOrderId, batchId = null, userId = 'COCKPIT-USER') {
  if (useMock) {
    const recommendedBatchId = batchId || mockSimulationResult.recommendedBatchId;
    mockOrderAssignments.set(packagingOrderId, {
      status: 'ALLOCATED',
      allocatedBatchId: recommendedBatchId,
      allocatedQuantity: mockOrders.find((o) => o.packagingOrderId === packagingOrderId)?.quantity,
    });
    return delay({
      ...mockSimulationResult,
      packagingOrderId,
      recommendedBatchId,
      status: 'SUCCESS',
    });
  }
  const { data } = await client.post('/allocation/execute', { packagingOrderId, batchId, userId });
  return data;
}

export async function releaseAllocation(packagingOrderId, userId = 'COCKPIT-USER') {
  if (useMock) {
    mockOrderAssignments.delete(packagingOrderId);
    return delay({
      packagingOrderId,
      status: 'RELEASED',
      releasedBatchId: null,
      releasedQuantity: 0,
      inventoryRestored: false,
    });
  }
  const { data } = await client.post('/allocation/release', { packagingOrderId, userId });
  return data;
}

export async function massRelease(payload = {}) {
  if (useMock) {
    const ids = payload.packagingOrderIds || mockSimulationRecommendations.map((r) => r.packagingOrderId);
    for (const id of ids) {
      mockOrderAssignments.delete(id);
    }
    return delay({
      releaseId: 'REL-MOCK001',
      timestamp: new Date().toISOString(),
      totalOrders: ids.length,
      successful: ids.length,
      failed: 0,
      results: ids.map((id) => ({
        packagingOrderId: id,
        status: 'RELEASED',
        releasedBatchId: null,
        inventoryRestored: false,
      })),
    });
  }
  const { data } = await client.post('/allocation/mass-release', {
    userId: 'COCKPIT-USER',
    ...payload,
  });
  return data;
}

export async function massSimulate(payload = {}) {
  if (useMock) {
    return delay({
      simulationId: 'SIM-MOCK001',
      timestamp: new Date().toISOString(),
      totalOrders: mockOrders.length,
      successful: mockOrders.length - 1,
      failed: 1,
      results: mockSimulationRecommendations.map((r) => ({
        packagingOrderId: r.packagingOrderId,
        status: r.status === 'PENDING' ? 'FAILED' : 'SIMULATED',
        recommendedBatchId: r.recommendedBatchId,
        allocatedQuantity: r.quantity,
        failureReasons: r.status === 'PENDING' ? ['No compliant batch found'] : [],
        ruleChecks: [],
      })),
    });
  }
  const { data } = await client.post('/allocation/mass-simulate', {
    userId: 'COCKPIT-USER',
    statusFilter: 'PLANNED',
    ...payload,
  });
  return data;
}

export function isUsingMock() {
  return useMock;
}
