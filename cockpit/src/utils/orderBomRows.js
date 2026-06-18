import { formatFailureTooltip } from '@/utils/simulationResult';

/** Catalog fallback when packaging material master is not loaded from API. */
export const PACKAGING_MATERIAL_CATALOG = {
  'PM-1001': { desc: 'Blister foil Alpha 200µm', batchManaged: true },
  'PM-1002': { desc: 'Carton Alpha 120×80mm', batchManaged: false },
  'PM-2001': { desc: 'Capsule shell Beta size 1', batchManaged: true },
  'PM-2002': { desc: 'Label Beta 50mg', batchManaged: false },
  'PM-3001': { desc: 'Vial Gamma 10ml', batchManaged: true },
  'PM-4001': { desc: 'Bottle Delta 100ml', batchManaged: true },
  'PM-5001': { desc: 'Tube Epsilon 30g', batchManaged: false },
};

function resolvePm(pmId, catalog) {
  return catalog[pmId] || PACKAGING_MATERIAL_CATALOG[pmId] || { desc: pmId, batchManaged: false };
}

/**
 * Build tree rows: packaging order header (1) + BOM component lines (n).
 * Batch-managed components receive the recommended batch when available.
 */
export function buildOrderBomTreeRows(
  orders,
  {
    recommendations = [],
    getBatchById = () => null,
    packagingMaterials = {},
    simulationResultsByOrderId = {},
  } = {}
) {
  const catalog = { ...PACKAGING_MATERIAL_CATALOG, ...packagingMaterials };

  return orders.map((order) => {
    const rec = recommendations.find((r) => r.packagingOrderId === order.packagingOrderId);
    const cached = simulationResultsByOrderId[order.packagingOrderId];
    const status = rec?.status || cached?.status || order.status;
    const failureReasons = rec?.failureReasons || cached?.failureReasons || [];
    const ruleChecks = rec?.ruleChecks || cached?.ruleChecks || [];
    const failureTooltip = formatFailureTooltip({ status, failureReasons, ruleChecks });
    const dpBatchId = rec?.recommendedBatchId
      || (['ALLOCATED', 'PARTIALLY_ALLOCATED'].includes(order.status) ? order.allocatedBatchId : null);
    const dpBatch = dpBatchId ? getBatchById(dpBatchId) : null;
    const componentBatches = rec?.componentBatches || {};

    const children = [];

    children.push({
      id: `${order.packagingOrderId}:DP`,
      rowType: 'component',
      packagingOrderId: order.packagingOrderId,
      position: 10,
      materialNumber: order.materialNumber,
      materialDescription: order.materialDescription,
      componentType: 'DRUG_PRODUCT',
      batchManaged: true,
      quantity: order.quantity,
      unit: order.unit,
      recommendedBatchId: dpBatchId,
      batchMaterialNumber: dpBatch?.materialNumber || order.materialNumber,
      rmsl: rec?.rmsl ?? dpBatch?.remainingShelfLifeMonths,
    });

    (order.packagingMaterialNumbers || []).forEach((pmId, idx) => {
      const pm = resolvePm(pmId, catalog);
      const pmBatchId = componentBatches[pmId] || null;
      const pmBatch = pmBatchId ? getBatchById(pmBatchId) : null;

      children.push({
        id: `${order.packagingOrderId}:${pmId}`,
        rowType: 'component',
        packagingOrderId: order.packagingOrderId,
        position: 20 + idx * 10,
        materialNumber: pmId,
        materialDescription: pm.desc,
        componentType: 'PACKAGING_MATERIAL',
        batchManaged: pm.batchManaged === true,
        quantity: order.quantity,
        unit: pm.unit || order.unit,
        recommendedBatchId: pm.batchManaged ? pmBatchId : null,
        batchMaterialNumber: pmBatch?.materialNumber || (pm.batchManaged ? pmId : null),
        rmsl: pmBatch?.remainingShelfLifeMonths ?? null,
      });
    });

    return {
      id: order.packagingOrderId,
      rowType: 'header',
      packagingOrderId: order.packagingOrderId,
      destinationCountry: order.destinationCountry,
      materialNumber: order.materialNumber,
      materialDescription: order.materialDescription,
      quantity: order.quantity,
      unit: order.unit,
      status,
      simulationStatus: status,
      failureReasons,
      failureTooltip,
      recommendedBatchId: dpBatchId || null,
      batchMaterialNumber: dpBatch?.materialNumber || null,
      rmsl: rec?.rmsl ?? dpBatch?.remainingShelfLifeMonths ?? null,
      children,
    };
  });
}

/**
 * Flatten orders + recommendations for views that still pass order-level rows.
 */
export function enrichOrderRows(orders, { recommendations = [], getBatchById = () => null } = {}) {
  return orders.map((order) => {
    const rec = recommendations.find((r) => r.packagingOrderId === order.packagingOrderId);
    const batchId = rec?.recommendedBatchId
      || (['ALLOCATED', 'PARTIALLY_ALLOCATED'].includes(order.status) ? order.allocatedBatchId : null);
    const batch = batchId ? getBatchById(batchId) : null;
    return {
      ...order,
      recommendedBatchId: batchId,
      batchMaterialNumber: batch?.materialNumber || rec?.batchMaterialNumber,
      rmsl: rec?.rmsl ?? batch?.remainingShelfLifeMonths,
      simulationStatus: rec?.status || order.status,
      status: rec?.status || order.status,
    };
  });
}
