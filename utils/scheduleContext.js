const fs = require('fs');
const path = require('path');
const { isShadowPlanningEnabled } = require('./shadowPlanning');

function dataDir() {
  return process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
}

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir(), `${name}.json`), 'utf-8'));
  } catch {
    return null;
  }
}

function loadDraftHint() {
  if (!isShadowPlanningEnabled()) return null;
  const store = readJson('draftSchedules');
  const drafts = store?.drafts || [];
  const ready = drafts.find((d) => d.status === 'READY');
  if (ready) {
    return {
      draftScheduleId: ready.draftScheduleId,
      status: ready.status,
      itemCount: (ready.items || []).length,
      label: ready.label,
    };
  }
  const latest = drafts[0];
  if (latest && ['DRAFT', 'READY'].includes(latest.status)) {
    return {
      draftScheduleId: latest.draftScheduleId,
      status: latest.status,
      itemCount: (latest.items || []).length,
      label: latest.label,
    };
  }
  return null;
}

function loadScheduleContext() {
  const schedule = readJson('optimizedSchedule');
  const items = schedule?.items || [];
  const byOrderId = new Map();
  for (const item of items) {
    const id = item.packagingOrderId || item.packagingOrder;
    if (id) byOrderId.set(id, item);
  }

  return {
    shadowPlanning: isShadowPlanningEnabled(),
    draftHint: loadDraftHint(),
    scheduleMeta: schedule
      ? {
          scheduleId: schedule.scheduleId,
          status: schedule.status,
          confirmedAt: schedule.confirmedAt,
          plantId: schedule.plantId,
          label: schedule.label,
        }
      : null,
    scheduleItems: items,
    getScheduleSlot(packagingOrderId) {
      if (!packagingOrderId) return null;
      return byOrderId.get(packagingOrderId) || null;
    },
  };
}

module.exports = { loadScheduleContext };
