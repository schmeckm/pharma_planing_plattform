/**
 * Einheitliche Quelle für Planungsaufträge — planningOrders (Admin) + roughPlannedOrders (Global Planning).
 */

const { JsonRepository } = require('../utils/jsonRepository');
const { toRoughShape, normalizeRoughOrder } = require('../utils/planningOrderNormalizer');
const { ExecutableOrderEngine } = require('../engines/executableOrderEngine');

class PlanningOrderSourceService {
  constructor(repository = new JsonRepository()) {
    this.repository = repository;
    this.executable = new ExecutableOrderEngine(repository);
  }

  _readItems(collection) {
    const data = this.repository.read(collection);
    if (!data) return [];
    return Array.isArray(data) ? data : data.items || [];
  }

  /**
   * Vereinheitlichte Auftragsliste im Engine-Format (rough shape).
   * planningOrders überschreibt rough-Einträge bei gleicher orderId/packagingOrder oder salesOrder.
   */
  list({ withExecutability = false } = {}) {
    const roughItems = this._readItems('roughPlannedOrders').map(normalizeRoughOrder);
    const planningItems = this._readItems('planningOrders').map((o) => toRoughShape(o));

    const byPackaging = new Map();
    const bySalesOrder = new Map();

    for (const order of roughItems) {
      byPackaging.set(order.packagingOrder, order);
      if (order.salesOrder) bySalesOrder.set(order.salesOrder, order);
    }

    for (const order of planningItems) {
      const existing = byPackaging.get(order.packagingOrder)
        || (order.salesOrder ? bySalesOrder.get(order.salesOrder) : null);
      if (existing) {
        const merged = {
          ...existing,
          ...order,
          packagingOrder: existing.packagingOrder,
          packagingOrderId: existing.packagingOrder,
          sourceCollection: 'unified',
        };
        byPackaging.set(existing.packagingOrder, merged);
      } else {
        byPackaging.set(order.packagingOrder, order);
        if (order.salesOrder) bySalesOrder.set(order.salesOrder, order);
      }
    }

    const orders = [...byPackaging.values()];
    if (!withExecutability) return orders;
    return this.executable.assessMany(orders);
  }

  getSummary() {
    return this.executable.summarize(this.list());
  }

  getExecutabilityOverview() {
    const summary = this.getSummary();
    return {
      timestamp: new Date().toISOString(),
      source: 'unified',
      ...summary,
      orders: summary.orders.map((o) => ({
        packagingOrder: o.packagingOrder,
        material: o.material,
        productionLine: o.productionLine,
        destinationCountry: o.destinationCountry,
        executableStatus: o.executableStatus,
        blockReasons: o.blockReasons,
        sourceCollection: o.sourceCollection,
      })),
    };
  }

  /** Schreibt Felder zurück in planningOrders (Shadow — keine SAP-Schreiboperation). */
  upsertPlanningOrder(packagingOrder, updates) {
    const items = this._readItems('planningOrders');
    const rough = this.list().find((o) => o.packagingOrder === packagingOrder);
    const idx = items.findIndex((o) => (o.orderId || o.packagingOrder) === (rough?.orderId || packagingOrder));
    const base = idx >= 0 ? items[idx] : toRoughShape(rough || { orderId: packagingOrder });
    const next = {
      orderId: base.orderId || packagingOrder,
      plant: base.plant || '1000',
      finishedGoodMaterial: updates.finishedGoodMaterial || base.finishedGoodMaterial || base.material,
      orderQuantity: updates.orderQuantity ?? base.orderQuantity ?? base.quantity,
      salesOrder: base.salesOrder,
      destinationCountry: base.destinationCountry,
      priority: updates.priority || base.priority,
      plannedStartDate: updates.plannedStartDate || base.plannedStartDate,
      plannedEndDate: updates.plannedEndDate || base.plannedEndDate,
      requestedDeliveryDate: base.requestedDeliveryDate,
      productionLine: updates.productionLine || base.productionLine,
      planningStatus: updates.planningStatus || base.planningStatus || 'PLANNED',
      durationHours: updates.durationHours ?? base.durationHours,
      executableStatus: updates.executableStatus,
      blockReasons: updates.blockReasons,
    };
    if (idx >= 0) items[idx] = { ...items[idx], ...next };
    else items.push(next);
    this.repository.write('planningOrders', { items });
    return next;
  }
}

module.exports = { PlanningOrderSourceService };
