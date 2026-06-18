const { JsonRepository } = require('../utils/jsonRepository');

const RESULT = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
};

/**
 * Inventory engine — ATP, reserved stock, and batch availability.
 * Reads inventory.json and atpReservations.json; never hardcodes business thresholds.
 */
class InventoryEngine {
  constructor(repository = new JsonRepository()) {
    this.repository = repository;
  }

  getInventoryRecords() {
    const data = this.repository.read('inventory');
    if (!data) return [];
    return Array.isArray(data) ? data : data.items || [];
  }

  getReservations() {
    return this.repository.readArray('atpReservations');
  }

  getReservedQuantity(batchId, reservations = null) {
    const items = reservations || this.getReservations();
    return items
      .filter((r) => r.batchId === batchId && r.status === 'ACTIVE')
      .reduce((sum, r) => sum + (r.reservedQuantity || 0), 0);
  }

  calculateAtp(batch, reservations = null) {
    const reserved = this.getReservedQuantity(batch.batchId, reservations);
    const inventory = this.getInventoryRecords().find((i) => i.batchId === batch.batchId);
    const unrestricted = inventory?.availableQuantity ?? batch.availableQuantity ?? batch.quantity ?? 0;
    const atpQty = Math.max(0, unrestricted - reserved);
    return { atpQuantity: atpQty, reservedQuantity: reserved, availableQuantity: unrestricted };
  }

  hasSufficientQuantity(batch, order) {
    return (batch.availableQuantity ?? 0) >= order.quantity;
  }

  checkAtp(batch, order, ruleDef, context = {}) {
    const reservations = context.reservations || this.getReservations();
    const { atpQuantity, reservedQuantity, availableQuantity } = this.calculateAtp(batch, reservations);
    const required = order.quantity;
    const passed = atpQuantity >= required;

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'AVAILABILITY',
      result: passed ? RESULT.PASSED : RESULT.FAILED,
      message: passed
        ? `ATP ${atpQuantity} EA >= required ${required} EA (available ${availableQuantity}, reserved ${reservedQuantity})`
        : `ATP check failed: ${atpQuantity} EA < required ${required} EA on batch ${batch.batchId}`,
      evidence: { atpQuantity, reservedQuantity, requiredQuantity: required },
    };
  }

  checkReservedInventory(batch, order, ruleDef, context = {}) {
    const reservations = (context.reservations || this.getReservations())
      .filter((r) => r.batchId === batch.batchId && r.status === 'ACTIVE');

    const conflict = reservations.find(
      (r) => r.reservedForOrderId
        && r.reservedForOrderId !== order.packagingOrderId
        && r.reservedForCountry
        && r.reservedForCountry !== order.destinationCountry,
    );

    if (!conflict) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'AVAILABILITY',
        result: RESULT.PASSED,
        message: reservations.length
          ? `No conflicting reservation for ${order.packagingOrderId} (${reservations.length} active reservation(s))`
          : 'No active reservations on batch',
      };
    }

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'AVAILABILITY',
      result: RESULT.FAILED,
      message: `Batch ${batch.batchId} reserved for ${conflict.reservedForCountry} (order ${conflict.reservedForOrderId}) — conflict with ${order.destinationCountry}`,
    };
  }

  deductQuantity(batchId, quantity) {
    const batch = this.repository.findInArray('batches', 'batchId', batchId);
    if (!batch) return null;

    const updatedBatch = {
      ...batch,
      availableQuantity: batch.availableQuantity - quantity,
    };
    this.repository.updateInArray('batches', 'batchId', batchId, {
      availableQuantity: updatedBatch.availableQuantity,
    });

    const inventory = this.getInventoryRecords();
    const invIndex = inventory.findIndex((i) => i.batchId === batchId);
    if (invIndex >= 0) {
      const inv = inventory[invIndex];
      const newAvail = (inv.availableQuantity ?? inv.quantity) - quantity;
      inventory[invIndex] = {
        ...inv,
        availableQuantity: newAvail,
        atpQuantity: Math.max(0, newAvail - this.getReservedQuantity(batchId)),
      };
      this.repository.writeArray('inventory', inventory);
    }

    return updatedBatch;
  }

  restoreQuantity(batchId, quantity) {
    const batch = this.repository.findInArray('batches', 'batchId', batchId);
    if (!batch) return null;

    const updatedAvailable = (batch.availableQuantity ?? 0) + quantity;
    this.repository.updateInArray('batches', 'batchId', batchId, {
      availableQuantity: updatedAvailable,
    });

    const inventory = this.getInventoryRecords();
    const invIndex = inventory.findIndex((i) => i.batchId === batchId);
    if (invIndex >= 0) {
      const inv = inventory[invIndex];
      const newAvail = (inv.availableQuantity ?? inv.quantity ?? 0) + quantity;
      inventory[invIndex] = {
        ...inv,
        availableQuantity: newAvail,
        atpQuantity: Math.max(0, newAvail - this.getReservedQuantity(batchId)),
      };
      this.repository.writeArray('inventory', inventory);
    }

    return { ...batch, availableQuantity: updatedAvailable };
  }
}

module.exports = { InventoryEngine, RESULT };
