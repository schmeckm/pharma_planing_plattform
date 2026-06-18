const { ExceptionService } = require('../../services/exceptionService');
const svc = new ExceptionService();

function list(req, res, next) {
  try {
    res.json(svc.list(req.query));
  } catch (err) { next(err); }
}

function getById(req, res, next) {
  try {
    res.json(svc.getById(req.params.exceptionId));
  } catch (err) { next(err); }
}

function addComment(req, res, next) {
  try {
    res.json(svc.addComment(req.params.exceptionId, { ...req.body, userId: req.user.userId }));
  } catch (err) { next(err); }
}

function escalate(req, res, next) {
  try {
    res.json(svc.escalate(req.params.exceptionId, { ...req.body, userId: req.user.userId }));
  } catch (err) { next(err); }
}

function resolve(req, res, next) {
  try {
    res.json(svc.resolve(req.params.exceptionId, { ...req.body, userId: req.user.userId }));
  } catch (err) { next(err); }
}

function review(req, res, next) {
  try {
    res.json(svc.review(req.params.exceptionId, { ...req.body, userId: req.user.userId }));
  } catch (err) { next(err); }
}

module.exports = { list, getById, addComment, escalate, resolve, review };
