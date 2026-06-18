const { AutonomousPlanningService } = require('../../services/autonomousPlanningService');
const svc = new AutonomousPlanningService();

function status(req, res, next) {
  try {
    res.json(svc.getStatus());
  } catch (err) { next(err); }
}

function runs(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    res.json(svc.getRuns(limit));
  } catch (err) { next(err); }
}

function run(req, res, next) {
  svc.runAutopilot({
    userId: req.headers['x-user-id'] || 'AUTOPILOT',
    dryRun: req.body.dryRun === true,
    maxOrders: req.body.maxOrders || null,
  })
    .then((result) => res.json(result))
    .catch(next);
}

function updatePolicy(req, res, next) {
  try {
    res.json({ policy: svc.updatePolicy(req.body) });
  } catch (err) { next(err); }
}

module.exports = { status, runs, run, updatePolicy };
