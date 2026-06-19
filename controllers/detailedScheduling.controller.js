const { DetailedSchedulingService } = require('../services/detailedSchedulingService');

const svc = new DetailedSchedulingService();

async function getMasterData(_req, res, next) {
  try {
    res.json(svc.getMasterData());
  } catch (err) {
    next(err);
  }
}

async function getDashboard(_req, res, next) {
  try {
    res.json(await svc.getDashboard());
  } catch (err) {
    next(err);
  }
}

async function buildSchedule(req, res, next) {
  try {
    res.json(await svc.buildSchedule(req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function getSchedule(_req, res, next) {
  try {
    const schedule = svc.getActiveSchedule();
    if (!schedule) {
      return res.status(404).json({ error: 'NO_SCHEDULE', message: 'No schedule built yet' });
    }
    res.json(schedule);
  } catch (err) {
    next(err);
  }
}

async function runWhatIf(req, res, next) {
  try {
    res.json(await svc.runWhatIf(req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function rescheduleOrder(req, res, next) {
  try {
    res.json(svc.rescheduleOrder(req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function explainOrder(req, res, next) {
  try {
    const orderNumber = req.params.orderNumber;
    res.json(await svc.explainBlockedOrder(orderNumber));
  } catch (err) {
    next(err);
  }
}

async function explainSchedule(_req, res, next) {
  try {
    res.json(await svc.explainSchedule());
  } catch (err) {
    next(err);
  }
}

async function getIntegrationCatalog(_req, res, next) {
  try {
    res.json(svc.getIntegrationCatalog());
  } catch (err) {
    next(err);
  }
}

async function confirmSchedule(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || 'SYSTEM';
    res.json(svc.confirmSchedule({
      label: req.body?.label,
      userId,
      scheduleId: req.body?.scheduleId,
      draftScheduleId: req.body?.draftScheduleId,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMasterData,
  getDashboard,
  buildSchedule,
  getSchedule,
  runWhatIf,
  rescheduleOrder,
  explainOrder,
  explainSchedule,
  getIntegrationCatalog,
  confirmSchedule,
};
