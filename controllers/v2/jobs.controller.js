const { JobService } = require('../../services/jobService');
const svc = new JobService();

function createJob(req, res, next) {
  try {
    res.status(202).json(svc.createMassAllocationJob({ ...req.body, userId: req.user.userId }));
  } catch (err) { next(err); }
}

function getJob(req, res, next) {
  try {
    res.json(svc.getJob(req.params.jobId));
  } catch (err) { next(err); }
}

function listJobs(req, res, next) {
  try {
    res.json(svc.listJobs(req.query));
  } catch (err) { next(err); }
}

function cancelJob(req, res, next) {
  try {
    res.json(svc.cancelJob(req.params.jobId));
  } catch (err) { next(err); }
}

module.exports = { createJob, getJob, listJobs, cancelJob };
