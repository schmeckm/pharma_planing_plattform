class SetupOptimizationEngine {
  constructor(setupMatrix) {
    this.matrix = setupMatrix?.items || [];
    this.defaultMinutes = setupMatrix?.defaultSetupMinutes || 30;
    this.lookup = {};
    for (const row of this.matrix) {
      this.lookup[`${row.fromColor}|${row.toColor}`] = row.setupMinutes;
    }
  }

  setupMinutes(fromColor, toColor) {
    if (!fromColor || fromColor === 'Clear') {
      return this.lookup[`Clear|${toColor}`] ?? 15;
    }
    return this.lookup[`${fromColor}|${toColor}`] ?? this.defaultMinutes;
  }

  /** Campaign grouping — sort by campaign group to minimize changeovers. */
  campaignSort(orders) {
    const groups = {};
    for (const o of orders) {
      const g = o.campaignGroup || o.materialNumber;
      if (!groups[g]) groups[g] = [];
      groups[g].push(o);
    }
    const sortedGroups = Object.keys(groups).sort();
    const result = [];
    for (const g of sortedGroups) {
      result.push(...groups[g]);
    }
    return result;
  }

  /** TSP-lite: greedy nearest setup within a line sequence. */
  optimizeSequence(orders) {
    if (orders.length <= 1) return orders;
    const remaining = [...orders];
    const sorted = [remaining.shift()];
    while (remaining.length) {
      const last = sorted[sorted.length - 1];
      let bestIdx = 0;
      let bestSetup = Infinity;
      for (let i = 0; i < remaining.length; i += 1) {
        const setup = this.setupMinutes(last.colorFamily, remaining[i].colorFamily);
        if (setup < bestSetup) {
          bestSetup = setup;
          bestIdx = i;
        }
      }
      sorted.push(remaining.splice(bestIdx, 1)[0]);
    }
    return sorted;
  }

  totalSetupMinutes(orders) {
    if (!orders.length) return 0;
    let total = this.setupMinutes('Clear', orders[0].colorFamily);
    for (let i = 1; i < orders.length; i += 1) {
      total += this.setupMinutes(orders[i - 1].colorFamily, orders[i].colorFamily);
    }
    return total;
  }
}

module.exports = { SetupOptimizationEngine };
