/**
 * Normalisiert Planungsaufträge zwischen Admin-Format (planningOrders) und Engine-Format (roughPlannedOrders).
 */

function toIsoDateTime(dateStr, hour = '08:00:00') {
  if (!dateStr) return null;
  if (dateStr.includes('T')) return dateStr;
  return `${dateStr}T${hour}`;
}

function toRoughShape(raw) {
  const packagingOrder = raw.packagingOrder || raw.packagingOrderId || raw.orderId;
  const material = raw.material || raw.finishedGoodMaterial || raw.materialNumber;
  const quantity = raw.quantity ?? raw.orderQuantity ?? 0;
  const plannedStartDate = raw.plannedStartDate || raw.roughPlannedStart?.slice(0, 10);
  const plannedEndDate = raw.plannedEndDate || raw.roughPlannedEnd?.slice(0, 10);

  return {
    ...raw,
    orderId: raw.orderId || packagingOrder,
    packagingOrder,
    packagingOrderId: packagingOrder,
    material,
    materialNumber: material,
    quantity,
    orderQuantity: quantity,
    plannedStartDate,
    plannedEndDate,
    roughPlannedStart: raw.roughPlannedStart || toIsoDateTime(plannedStartDate),
    roughPlannedEnd: raw.roughPlannedEnd || toIsoDateTime(plannedEndDate, '16:00:00'),
    productionLine: raw.productionLine || raw.preferredLine || null,
    preferredLine: raw.preferredLine || raw.productionLine || null,
    planningStatus: raw.planningStatus || raw.status || 'ROUGH',
    sourceCollection: raw.sourceCollection || 'planningOrders',
  };
}

function normalizeRoughOrder(raw) {
  return toRoughShape({ ...raw, sourceCollection: raw.sourceCollection || 'roughPlannedOrders' });
}

module.exports = { toRoughShape, normalizeRoughOrder, toIsoDateTime };
