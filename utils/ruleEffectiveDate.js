const { ValidationError } = require('./errors');

function isRuleEffective(rule, referenceDate = new Date()) {
  if (!rule || rule.active === false) return false;
  const ref = new Date(referenceDate);
  if (Number.isNaN(ref.getTime())) return true;

  if (rule.effectiveFrom) {
    const from = new Date(rule.effectiveFrom);
    if (!Number.isNaN(from.getTime()) && ref < from) return false;
  }
  if (rule.effectiveTo) {
    const to = new Date(rule.effectiveTo);
    if (!Number.isNaN(to.getTime()) && ref > to) return false;
  }
  return true;
}

function validateEffectiveWindow(effectiveFrom, effectiveTo) {
  if (!effectiveFrom && !effectiveTo) return;
  const from = effectiveFrom ? new Date(effectiveFrom) : null;
  const to = effectiveTo ? new Date(effectiveTo) : null;
  if (from && Number.isNaN(from.getTime())) {
    throw new ValidationError('effectiveFrom is not a valid date');
  }
  if (to && Number.isNaN(to.getTime())) {
    throw new ValidationError('effectiveTo is not a valid date');
  }
  if (from && to && to < from) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom');
  }
}

module.exports = { isRuleEffective, validateEffectiveWindow };
