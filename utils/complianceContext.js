const fs = require('fs');
const path = require('path');
const { loadScheduleContext } = require('./scheduleContext');

function dataDir() {
  return process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
}

function readItems(filename) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir(), filename), 'utf-8'));
    return data.items || data;
  } catch {
    return [];
  }
}

function loadComplianceContext() {
  const inspectionLots = readItems('inspectionLots.json');
  const reservations = readItems('atpReservations.json');
  const packingMappings = readItems('packingMappings.json');
  let ruleSetVersion = '1.0.0';
  try {
    const rules = JSON.parse(fs.readFileSync(path.join(dataDir(), 'rules.json'), 'utf-8'));
    ruleSetVersion = rules.ruleSetVersion || '1.0.0';
  } catch { /* default */ }

  const scheduleContext = loadScheduleContext();

  return {
    ...scheduleContext,
    inspectionLots,
    reservations,
    packingMappings,
    ruleSetVersion,
    getPackingMapping(packagingOrderId) {
      return packingMappings.find((m) => m.packagingOrderId === packagingOrderId) || null;
    },
    getInspectionLot(batchId) {
      return inspectionLots.find((l) => l.batchId === batchId) || null;
    },
    getReservations(batchId) {
      return reservations.filter((r) => r.batchId === batchId && r.status === 'ACTIVE');
    },
  };
}

module.exports = { loadComplianceContext };
