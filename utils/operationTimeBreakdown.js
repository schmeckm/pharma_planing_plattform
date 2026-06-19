/**
 * SAP-style operation time split: setup (Rüst) · production · teardown (Abrüst).
 * Uses explicit routing fields when present; otherwise splits total duration.
 */

const DEFAULT_SHARES = { setup: 0.1, production: 0.8, teardown: 0.1 };

function roundHours(value) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function splitTotalHours(totalHours, shares = DEFAULT_SHARES) {
  const total = Math.max(0.1, Number(totalHours) || 0.1);
  let setup = roundHours(total * shares.setup);
  let production = roundHours(total * shares.production);
  let teardown = roundHours(total * shares.teardown);
  const sum = setup + production + teardown;
  if (sum !== total) {
    production = roundHours(production + (total - sum));
  }
  return { setupHours: setup, productionHours: production, teardownHours: teardown };
}

/**
 * @param {object} input
 * @param {number} [input.standardSetupHours]
 * @param {number} [input.standardProductionHours]
 * @param {number} [input.standardTeardownHours]
 * @param {number} [input.standardDurationHours]
 * @param {number} [input.durationHours]
 */
function resolveOperationTimes(input = {}) {
  const setup = input.standardSetupHours ?? input.setupHours;
  const production = input.standardProductionHours ?? input.productionHours;
  const teardown = input.standardTeardownHours ?? input.teardownHours;

  if (
    Number.isFinite(setup)
    && Number.isFinite(production)
    && Number.isFinite(teardown)
  ) {
    const setupHours = roundHours(setup);
    const productionHours = roundHours(production);
    const teardownHours = roundHours(teardown);
    return {
      setupHours,
      productionHours,
      teardownHours,
      durationHours: roundHours(setupHours + productionHours + teardownHours),
    };
  }

  const total = input.standardDurationHours ?? input.durationHours ?? 1;
  const times = splitTotalHours(total);
  return { ...times, durationHours: roundHours(total) };
}

function timeSegmentPercents(setupHours, productionHours, teardownHours) {
  const total = setupHours + productionHours + teardownHours;
  if (total <= 0) {
    return { setupPct: 0, productionPct: 100, teardownPct: 0 };
  }
  return {
    setupPct: Math.round((setupHours / total) * 1000) / 10,
    productionPct: Math.round((productionHours / total) * 1000) / 10,
    teardownPct: Math.round((teardownHours / total) * 1000) / 10,
  };
}

function enrichOperationWithTimes(op) {
  const times = resolveOperationTimes(op);
  const percents = timeSegmentPercents(
    times.setupHours,
    times.productionHours,
    times.teardownHours,
  );
  return {
    ...op,
    ...times,
    ...percents,
  };
}

module.exports = {
  DEFAULT_SHARES,
  resolveOperationTimes,
  splitTotalHours,
  timeSegmentPercents,
  enrichOperationWithTimes,
};
