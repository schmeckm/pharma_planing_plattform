/**
 * Date utilities for time-based allocation planning.
 */
function remainingShelfLifeMonths(expiryDate, referenceDate = new Date()) {
  const expiry = new Date(expiryDate);
  const reference = new Date(referenceDate);
  if (expiry <= reference) return 0;

  let months =
    (expiry.getFullYear() - reference.getFullYear()) * 12 +
    (expiry.getMonth() - reference.getMonth());
  const dayFraction = (expiry.getDate() - reference.getDate()) / 30;
  return Math.max(0, Math.round((months + dayFraction) * 10) / 10);
}

function remainingShelfLifePercent(expiryDate, productionDate, referenceDate = new Date()) {
  const totalLife = remainingShelfLifeMonths(expiryDate, productionDate);
  if (totalLife <= 0) return 0;
  const remaining = remainingShelfLifeMonths(expiryDate, referenceDate);
  return Math.round((remaining / totalLife) * 1000) / 10;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr);
  const b = new Date(toStr);
  return Math.round((b - a) / 86400000);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(d) {
  return d ? new Date(d) : new Date();
}

module.exports = {
  remainingShelfLifeMonths,
  remainingShelfLifePercent,
  addDays,
  daysBetween,
  todayISO,
  parseDate,
};
