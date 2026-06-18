const { remainingShelfLifeMonths } = require('../utils/dateUtils');

const RESULT = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
};

/**
 * Remaining Shelf Life (RMSL) engine — shelf-life calculations and threshold checks.
 * Rules and thresholds are loaded from rules.json (countryRules.rmslThresholdMonths).
 */
class RmslEngine {
  calculateRemainingMonths(batch, referenceDate = new Date()) {
    return remainingShelfLifeMonths(batch.expiryDate, referenceDate);
  }

  meetsThreshold(batch, countryRule, referenceDate = new Date()) {
    const remaining = this.calculateRemainingMonths(batch, referenceDate);
    const threshold = countryRule?.rmslThresholdMonths ?? 0;
    return {
      remainingMonths: remaining,
      thresholdMonths: threshold,
      passed: remaining >= threshold,
    };
  }

  validate(batch, destinationCountry, countryRule, ruleDef, referenceDate = new Date()) {
    const { remainingMonths, thresholdMonths, passed } = this.meetsThreshold(
      batch,
      countryRule,
      referenceDate,
    );

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'COMPLIANCE',
      result: passed ? RESULT.PASSED : RESULT.FAILED,
      message: passed
        ? `RMSL ${remainingMonths.toFixed(1)} months >= threshold ${thresholdMonths} months for ${destinationCountry}`
        : `RMSL ${remainingMonths.toFixed(1)} months < threshold ${thresholdMonths} months for ${destinationCountry}`,
      evidence: {
        remainingShelfLifeMonths: Math.round(remainingMonths * 10) / 10,
        thresholdMonths,
      },
    };
  }
}

module.exports = { RmslEngine, RESULT: RESULT };
