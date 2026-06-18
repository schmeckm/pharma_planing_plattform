const { CopilotService } = require('../../services/copilotService');
const svc = new CopilotService();

function ask(req, res, next) {
  try {
    res.json(svc.ask({ ...req.body, userId: req.user.userId }));
  } catch (err) { next(err); }
}

module.exports = { ask };
