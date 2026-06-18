class SequencingEngine {
  constructor(repository) {
    this.repository = repository;
  }

  getSequenceState(countryCode, rulesData) {
    const state = rulesData.sequenceState || {};
    return state[countryCode] || { lastAllocatedSequence: 0, lastBatchId: null, lastOrderId: null };
  }

  getLastSequence(countryCode, rulesData) {
    return this.getSequenceState(countryCode, rulesData).lastAllocatedSequence;
  }

  updateSequenceAfterAllocation(order, batch, rulesData) {
    const countryRule = (rulesData.countryRules || []).find(
      (r) => r.countryCode === order.destinationCountry && r.requiresContinuousSequence
    );
    if (!countryRule || batch.batchSequence == null) return rulesData;

    // Persist only the sequenceState back to the raw base rules.json. Avoid
    // writing the merged runtime rules (which may contain rulesV2-derived
    // enterpriseRules / rulesSource) — that would pollute the source-of-truth.
    const baseRules = this.repository.read('rules') || {};
    const sequenceState = { ...(baseRules.sequenceState || {}) };
    sequenceState[order.destinationCountry] = {
      lastAllocatedSequence: batch.batchSequence,
      lastBatchId: batch.batchId,
      lastOrderId: order.packagingOrderId,
    };
    baseRules.sequenceState = sequenceState;
    this.repository.write('rules', baseRules);

    return { ...rulesData, sequenceState };
  }
}

module.exports = { SequencingEngine };
