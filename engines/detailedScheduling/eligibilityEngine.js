const { generateId } = require('../../utils/idGenerator');

const EXCEPTION_TYPES = {
  MISSING_MATERIAL: 'Missing Material',
  MISSING_QA_RELEASE: 'Missing QA Release',
  COUNTRY_RESTRICTION: 'Country Restriction',
  SHELF_LIFE_VIOLATION: 'Shelf Life Violation',
  CAPACITY_OVERLOAD: 'Capacity Overload',
  LINE_QUALIFICATION_MISSING: 'Line Qualification Missing',
  QA_INSPECTION_PENDING: 'QA Inspection Pending',
  PLANNING_HORIZON_VIOLATION: 'Planning Horizon Violation',
};

class EligibilityEngine {
  constructor(masterData) {
    this.md = masterData;
  }

  _remainingShelfLifePct(batch) {
    if (!batch?.expiryDate) return 100;
    const expiry = new Date(batch.expiryDate);
    const now = new Date();
    const totalMs = expiry - new Date(batch.productionDate || batch.createdDate || '2020-01-01');
    const remainMs = expiry - now;
    if (totalMs <= 0) return 0;
    return Math.round((remainMs / totalMs) * 1000) / 10;
  }

  _minShelfLifePct(country) {
    const eu = this.md.euCountries.has(country);
    return eu ? 60 : 80;
  }

  _findBatch(order) {
    const batches = (this.md.batchByMaterial[order.materialNumber] || [])
      .filter((b) => b.qualityStatus === 'RELEASED' || b.qualityStatus === 'INSPECTION')
      .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
    return batches[0] || null;
  }

  _findInspectionLot(batchId) {
    return this.md.inspectionLots.find((l) => l.batchId === batchId) || null;
  }

  _atpAvailable(order) {
    const inv = this.md.inventory.filter(
      (i) => (i.materialNumber === order.materialNumber || i.material === order.materialNumber)
        && (i.availableQuantity || i.quantity || 0) >= order.quantity,
    );
    if (inv.length) return { ok: true, source: 'inventory' };
    const batch = this._findBatch(order);
    if (batch && (batch.availableQuantity || batch.quantity || 0) >= order.quantity) {
      return { ok: true, source: 'batch', batchId: batch.batchId };
    }
    return { ok: false, available: batch?.availableQuantity || 0 };
  }

  checkOrder(order, lineId = order.packagingLine) {
    const exceptions = [];
    const checks = [];
    let eligible = true;
    let recommendedBatch = null;
    let qaAction = null;

    const qual = this.md.qualificationByLine[lineId];
    if (qual && !qual.qualifiedPackageTypes.includes(order.packageType)) {
      eligible = false;
      exceptions.push(this._exception(order, EXCEPTION_TYPES.LINE_QUALIFICATION_MISSING,
        `Line ${lineId} cannot package ${order.packageType}. Qualified: ${qual.qualifiedPackageTypes.join(', ')}`));
      checks.push({ check: 'LINE_QUALIFICATION', passed: false });
    } else {
      checks.push({ check: 'LINE_QUALIFICATION', passed: true });
    }

    const atp = this._atpAvailable(order);
    if (!atp.ok) {
      eligible = false;
      exceptions.push(this._exception(order, EXCEPTION_TYPES.MISSING_MATERIAL,
        `Insufficient material ATP for ${order.materialNumber}. Required ${order.quantity}, available ${atp.available || 0}`));
      checks.push({ check: 'ATP', passed: false });
    } else {
      checks.push({ check: 'ATP', passed: true, detail: atp.source });
    }

    const batch = this._findBatch(order);
    recommendedBatch = batch?.batchId || null;

    if (!batch) {
      const pendingLot = this.md.inspectionLots.find(
        (l) => l.materialNumber === order.materialNumber && ['PENDING', 'IN_PROGRESS'].includes(l.status),
      );
      if (pendingLot) {
        qaAction = {
          lotId: pendingLot.lotId,
          message: `Inspection lot ${pendingLot.lotId} could unblock order ${order.orderNumber}.`,
        };
        exceptions.push(this._exception(order, EXCEPTION_TYPES.QA_INSPECTION_PENDING, qaAction.message));
      }
      eligible = false;
      exceptions.push(this._exception(order, EXCEPTION_TYPES.MISSING_QA_RELEASE,
        `No released batch for material ${order.materialNumber}`));
      checks.push({ check: 'QA_RELEASE', passed: false });
    } else if (batch.qualityStatus === 'BLOCKED') {
      eligible = false;
      exceptions.push(this._exception(order, EXCEPTION_TYPES.MISSING_QA_RELEASE,
        `Batch ${batch.batchId} is blocked`));
      checks.push({ check: 'QA_RELEASE', passed: false });
    } else if (batch.qualityStatus === 'INSPECTION') {
      const lot = this._findInspectionLot(batch.batchId);
      qaAction = {
        lotId: lot?.lotId || batch.batchId,
        message: `Inspection lot ${lot?.lotId || batch.batchId} could unblock order ${order.orderNumber}.`,
      };
      checks.push({ check: 'QA_RELEASE', passed: false, pending: true });
    } else {
      checks.push({ check: 'QA_RELEASE', passed: true, batchId: batch.batchId });

      const approvals = batch.approvedCountries || [];
      if (order.country && !approvals.includes(order.country)) {
        eligible = false;
        exceptions.push(this._exception(order, EXCEPTION_TYPES.COUNTRY_RESTRICTION,
          `Batch ${batch.batchId} not approved for ${order.country}. Allowed: ${approvals.join(', ') || 'none'}`));
        checks.push({ check: 'TRIC', passed: false, batchId: batch.batchId, allowed: approvals });
      } else {
        checks.push({ check: 'TRIC', passed: true, batchId: batch.batchId });
      }

      const rmsl = this._remainingShelfLifePct(batch);
      const minPct = this._minShelfLifePct(order.country);
      if (rmsl < minPct) {
        eligible = false;
        exceptions.push(this._exception(order, EXCEPTION_TYPES.SHELF_LIFE_VIOLATION,
          `Remaining shelf life ${rmsl}% below minimum ${minPct}% for ${order.country}`));
        checks.push({ check: 'RMSL', passed: false, rmslPct: rmsl, minPct });
      } else {
        checks.push({ check: 'RMSL', passed: true, rmslPct: rmsl, minPct });
      }
    }

    return {
      orderNumber: order.orderNumber,
      eligible,
      recommendedBatch,
      qaAction,
      checks,
      exceptions,
    };
  }

  _exception(order, type, message) {
    return {
      exceptionId: generateId('EXC-DS'),
      type,
      orderNumber: order.orderNumber,
      materialNumber: order.materialNumber,
      country: order.country,
      severity: type === EXCEPTION_TYPES.CAPACITY_OVERLOAD ? 'MEDIUM' : 'HIGH',
      message,
      createdAt: new Date().toISOString(),
      status: 'OPEN',
    };
  }
}

module.exports = { EligibilityEngine, EXCEPTION_TYPES };
