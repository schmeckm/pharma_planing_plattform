const { RmslEngine } = require('./rmslEngine');
const { InventoryEngine } = require('./inventoryEngine');

const RESULT = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
};

class ComplianceEngine {
  constructor() {
    this.rmslEngine = new RmslEngine();
    this.inventoryEngine = new InventoryEngine();
  }

  checkQualityStatus(batch, ruleDef) {
    const allowed = ruleDef.parameters?.allowedStatuses || ['RELEASED'];
    const passed = allowed.includes(batch.qualityStatus);
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'COMPLIANCE',
      result: passed ? RESULT.PASSED : RESULT.FAILED,
      message: passed
        ? `Batch ${batch.batchId} is released for allocation`
        : `Batch ${batch.batchId} has status ${batch.qualityStatus}, not allowed`,
    };
  }

  checkTric(batch, destinationCountry, countryRule, ruleDef) {
    if (!countryRule.requiresTric) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'COMPLIANCE',
        result: RESULT.SKIPPED,
        message: `TRIC not required for ${destinationCountry}`,
      };
    }

    const approved = batch.approvedCountries || [];
    if (approved.includes(destinationCountry)) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'COMPLIANCE',
        result: RESULT.PASSED,
        message: `Batch ${batch.batchId} is TRIC-approved for ${destinationCountry}`,
      };
    }

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'COMPLIANCE',
      result: RESULT.FAILED,
      message: `Batch ${batch.batchId} is not TRIC-approved for ${destinationCountry}. Approved: ${approved.join(', ') || 'none'}`,
    };
  }

  checkRmsl(batch, destinationCountry, countryRule, ruleDef, referenceDate) {
    return this.rmslEngine.validate(batch, destinationCountry, countryRule, ruleDef, referenceDate);
  }

  checkBatchSplit(batch, order, countryRule, ruleDef) {
    if (countryRule.allowBatchSplit) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'COMPLIANCE',
        result: RESULT.PASSED,
        message: `Batch split allowed for ${order.destinationCountry} — quantity coverage is validated by the ATP gate`,
      };
    }

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'COMPLIANCE',
      result: RESULT.PASSED,
      message: `Single-batch fulfillment required for ${order.destinationCountry} — no cross-batch split (quantity verified by ATP)`,
    };
  }

  checkJapanSequence(batch, lastSequence, ruleDef) {
    const expected = lastSequence + 1;
    const actual = batch.batchSequence || 0;

    if (actual === expected) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'MARKET_RULES',
        result: RESULT.PASSED,
        message: `Batch sequence ${actual} follows expected sequence ${expected}`,
      };
    }

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'MARKET_RULES',
      result: RESULT.FAILED,
      message: `Continuous sequence violated: expected B${String(expected).padStart(2, '0')}, got sequence ${actual} (${batch.batchId})`,
    };
  }

  /** ATP — delegated to inventoryEngine */
  checkAtp(batch, order, ruleDef, context = {}) {
    return this.inventoryEngine.checkAtp(batch, order, ruleDef, context);
  }

  /** Reserved inventory — delegated to inventoryEngine */
  checkReservedInventory(batch, order, ruleDef, context = {}) {
    return this.inventoryEngine.checkReservedInventory(batch, order, ruleDef, context);
  }

  /** Quality stock — unrestricted released stock only (SAP QM integration point) */
  checkQualityStock(batch, ruleDef) {
    const stockType = batch.stockType || 'UNRESTRICTED';
    const blockedTypes = ['BLOCKED', 'QA_HOLD', 'QUALITY_INSPECTION', 'RESTRICTED'];
    const statusOk = batch.qualityStatus === 'RELEASED';
    const stockOk = !blockedTypes.includes(stockType) && !blockedTypes.includes(batch.qualityStatus);

    const passed = statusOk && stockOk;
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'COMPLIANCE',
      result: passed ? RESULT.PASSED : RESULT.FAILED,
      message: passed
        ? `Quality stock OK: status ${batch.qualityStatus}, stock type ${stockType}`
        : `Quality stock blocked: status ${batch.qualityStatus}, stock type ${stockType}`,
    };
  }

  /** Inspection lot — batch must have released usage decision (SAP QM QALS) */
  checkInspectionLot(batch, ruleDef, context = {}) {
    const lot = context.getInspectionLot?.(batch.batchId)
      || (context.inspectionLots || []).find((l) => l.batchId === batch.batchId);

    if (!lot) {
      if (batch.qualityStatus === 'RELEASED') {
        return {
          ruleId: ruleDef.ruleId,
          ruleName: ruleDef.ruleName,
          phase: 'COMPLIANCE',
          result: RESULT.PASSED,
          message: `No inspection lot record — batch ${batch.batchId} already released in ERP`,
        };
      }
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'COMPLIANCE',
        result: RESULT.FAILED,
        message: `No inspection lot found for unreleased batch ${batch.batchId}`,
      };
    }

    const released = ['RELEASED', 'USAGE_DECISION_RELEASED'].includes(lot.status);
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'COMPLIANCE',
      result: released ? RESULT.PASSED : RESULT.FAILED,
      message: released
        ? `Inspection lot ${lot.lotId} released for batch ${batch.batchId}`
        : `Inspection lot ${lot.lotId} status ${lot.status} — QA release required before allocation`,
      evidence: { lotId: lot.lotId, lotStatus: lot.status },
    };
  }

  /** Packing System — PO to SO mapping validation */
  checkPackingMapping(order, ruleDef, context = {}) {
    const mapping = context.getPackingMapping?.(order.packagingOrderId)
      || (context.packingMappings || []).find((m) => m.packagingOrderId === order.packagingOrderId);

    if (!mapping) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'COMPLIANCE',
        result: RESULT.SKIPPED,
        message: `No packing system mapping for ${order.packagingOrderId}`,
      };
    }

    const soMatch = !order.salesOrderId || mapping.salesOrderId === order.salesOrderId;
    const passed = soMatch && mapping.validationStatus !== 'INVALID';

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'COMPLIANCE',
      result: passed ? RESULT.PASSED : RESULT.FAILED,
      message: passed
        ? `Packing system ${mapping.packingSystemId}: FG ${order.packagingOrderId} → SO ${mapping.salesOrderId} validated`
        : `Packing mapping invalid: expected SO ${mapping.salesOrderId}, got ${order.salesOrderId || 'none'}`,
      evidence: {
        packingSystemId: mapping.packingSystemId,
        salesOrderId: mapping.salesOrderId,
        packagingOrderId: mapping.packagingOrderId,
      },
    };
  }
}

module.exports = { ComplianceEngine, RESULT };
