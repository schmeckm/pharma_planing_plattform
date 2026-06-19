const { SetupOptimizationEngine } = require('./setupOptimizationEngine');

class MultiLineEngine {
  constructor(masterData, setupEngine) {
    this.md = masterData;
    this.setup = setupEngine || new SetupOptimizationEngine(masterData.setupMatrix);
  }

  qualifiedLines(order) {
    return this.md.lineQualifications.filter(
      (q) => q.qualifiedPackageTypes.includes(order.packageType),
    );
  }

  scoreLine(order, lineId, lineState = {}) {
    const qual = this.md.qualificationByLine[lineId];
    const prodLine = this.md.lineById[lineId];
    if (!qual) return -Infinity;

    const setupMin = this.setup.setupMinutes(lineState.lastColor || 'Clear', order.colorFamily);
    const oee = qual.defaultOee || prodLine?.performanceFactor || 0.8;
    const bottleneckPenalty = qual.isBottleneck ? -200 : 0;
    const completionEstimate = (order.productionDurationHours / Math.max(0.5, oee)) + setupMin / 60;

    return 10000 - completionEstimate * 10 - setupMin + oee * 1000 + bottleneckPenalty;
  }

  selectBestLine(order, lineStates = {}) {
    const candidates = this.qualifiedLines(order);
    if (!candidates.length) return null;

    let best = candidates[0].lineId;
    let bestScore = -Infinity;
    for (const q of candidates) {
      const score = this.scoreLine(order, q.lineId, lineStates[q.lineId] || {});
      if (score > bestScore) {
        bestScore = score;
        best = q.lineId;
      }
    }
    return best;
  }
}

module.exports = { MultiLineEngine };
