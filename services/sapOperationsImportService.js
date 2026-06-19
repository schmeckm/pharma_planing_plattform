const fs = require('fs');
const path = require('path');
const { enrichOperationWithTimes } = require('../utils/operationTimeBreakdown');

/**
 * Phase 5 — SAP-style operation routings (AFVC / CRHD mock).
 */
class SapOperationsImportService {
  constructor(dataDir = null) {
    this._dir = dataDir || process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
    this._cache = null;
  }

  _loadSapRoutings() {
    if (this._cache) return this._cache;
    try {
      this._cache = JSON.parse(
        fs.readFileSync(path.join(this._dir, 'sapProcessOrderRoutings.json'), 'utf-8'),
      );
    } catch {
      this._cache = { routingsByMaterial: {}, source: 'NONE' };
    }
    return this._cache;
  }

  _loadTemplateRoutings() {
    try {
      return JSON.parse(fs.readFileSync(path.join(this._dir, 'operationRoutings.json'), 'utf-8'));
    } catch {
      return { default: [] };
    }
  }

  _templateStepsForMaterial(material) {
    const routings = this._loadTemplateRoutings();
    for (const [prefix, steps] of Object.entries(routings.byMaterialPrefix || {})) {
      if (material?.startsWith(prefix)) return steps;
    }
    return routings.default || [];
  }

  _resolvePackagingLine(order) {
    return order.productionLine || order.preferredLine || 'PACK_LINE_01';
  }

  _mapSapStep(step, order, poId, packagingLine, routingId) {
    const wcId = (step.workCenterId || step.workCenter || '').replace('{{packagingLine}}', packagingLine);
    return enrichOperationWithTimes({
      operationId: `${poId}-OP${step.operationNo}`,
      packagingOrder: poId,
      packagingOrderId: poId,
      processOrder: order.processOrder || null,
      operationNo: step.operationNo,
      sapOperationNo: step.sapOperationNo || String(step.operationNo).padStart(4, '0'),
      operationName: step.description || step.operationName || `Op ${step.operationNo}`,
      workCenterId: wcId,
      isBottleneck: !!step.isBottleneck,
      standardSetupHours: step.standardSetupHours,
      standardProductionHours: step.standardProductionHours,
      standardTeardownHours: step.standardTeardownHours,
      standardDurationHours: step.standardDurationHours || step.durationHours || 8,
      durationDays: null,
      plannedStartDate: null,
      plannedEndDate: null,
      destinationCountry: order.destinationCountry,
      priority: order.priority,
      priorityScore: order.priority === 'HIGH' ? 80 : order.priority === 'MEDIUM' ? 50 : 30,
      quantity: order.quantity,
      materialNumber: order.material || order.materialNumber,
      requestedDeliveryDate: order.requestedDeliveryDate,
      routingSource: 'SAP',
      sapRoutingId: routingId || null,
      controlKey: step.controlKey || 'PP01',
    });
  }

  _mapTemplateStep(step, order, poId, packagingLine) {
    const op = this._mapSapStep({
      ...step,
      description: step.operationName,
      standardDurationHours: Math.max(1, Math.round((order.durationHours || 16) * (step.durationShare || 0.33))),
    }, order, poId, packagingLine, null);
    op.routingSource = 'TEMPLATE';
    op.sapOperationNo = null;
    return op;
  }

  resolveOperationsForOrder(order) {
    const sap = this._loadSapRoutings();
    const poId = order.packagingOrder || order.packagingOrderId;
    const material = order.material || order.materialNumber || '';
    const packagingLine = this._resolvePackagingLine(order);

    const sapRouting = sap.routingsByMaterial?.[material];
    if (sapRouting?.operations?.length) {
      return {
        routingSource: 'SAP',
        routingId: sapRouting.routingId,
        routingGroup: sapRouting.routingGroup,
        operations: sapRouting.operations.map((step) => this._mapSapStep(
          step,
          order,
          poId,
          packagingLine,
          sapRouting.routingId,
        )),
      };
    }

    const steps = this._templateStepsForMaterial(material);
    return {
      routingSource: 'TEMPLATE',
      routingId: null,
      routingGroup: null,
      operations: steps.map((step) => this._mapTemplateStep(step, order, poId, packagingLine)),
    };
  }

  importForOrders(orders = []) {
    const results = orders.map((order) => ({
      order,
      ...this.resolveOperationsForOrder(order),
    }));

    const operations = results.flatMap((r) => r.operations);

    return {
      orders: results.map((r) => ({
        ...r.order,
        routingSource: r.routingSource,
        sapRoutingId: r.routingId,
        operations: r.operations,
      })),
      operations,
      summary: {
        orderCount: orders.length,
        operationCount: operations.length,
        sapRoutingCount: results.filter((r) => r.routingSource === 'SAP').length,
        templateRoutingCount: results.filter((r) => r.routingSource === 'TEMPLATE').length,
        sapDataSource: this._loadSapRoutings().source || 'NONE',
        lastSync: this._loadSapRoutings().lastSync || null,
      },
    };
  }

  getStatus() {
    const sap = this._loadSapRoutings();
    const materials = Object.keys(sap.routingsByMaterial || {});
    return {
      phase: 5,
      enabled: process.env.OPERATIONS_SOLVER !== 'off',
      solver: process.env.OPERATIONS_SOLVER || 'ortools',
      sapSource: sap.source,
      lastSync: sap.lastSync,
      materialRoutings: materials.length,
      materials,
    };
  }

  syncFromSapMock() {
    const filePath = path.join(this._dir, 'sapProcessOrderRoutings.json');
    const data = this._loadSapRoutings();
    data.lastSync = new Date().toISOString();
    data.source = 'SAP_AFVC_MOCK';
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    this._cache = data;
    return this.getStatus();
  }
}

module.exports = { SapOperationsImportService };
