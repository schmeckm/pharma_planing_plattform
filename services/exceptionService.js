const { getProvider } = require('../providers');
const { NotFoundError, ValidationError } = require('../utils/errors');

class ExceptionService {
  constructor(provider = getProvider()) {
    this.provider = provider;
  }

  list(filters = {}) {
    return this.provider.getExceptions(filters);
  }

  getById(exceptionId) {
    const ex = this.provider.getExceptions().find((e) => e.exceptionId === exceptionId);
    if (!ex) throw new NotFoundError('Exception', exceptionId);
    return ex;
  }

  create(exception) {
    return this.provider.createException(exception);
  }

  addComment(exceptionId, { text, userId, userName }) {
    const ex = this.getById(exceptionId);
    const comment = {
      commentId: `CMT-${Date.now()}`,
      text,
      userId,
      userName: userName || userId,
      createdAt: new Date().toISOString(),
    };
    ex.comments = ex.comments || [];
    ex.comments.push(comment);
    ex.updatedAt = new Date().toISOString();
    this.provider.updateException(exceptionId, { comments: ex.comments, updatedAt: ex.updatedAt });
    return this.getById(exceptionId);
  }

  escalate(exceptionId, { userId, assignTo, reason }) {
    const ex = this.getById(exceptionId);
    if (ex.status === 'RESOLVED') throw new ValidationError('Cannot escalate resolved exception');
    return this.provider.updateException(exceptionId, {
      status: 'ESCALATED',
      assignedTo: assignTo,
      escalatedBy: userId,
      escalationReason: reason,
      updatedAt: new Date().toISOString(),
    });
  }

  resolve(exceptionId, { userId, resolution }) {
    const ex = this.getById(exceptionId);
    ex.comments = ex.comments || [];
    ex.comments.push({
      commentId: `CMT-${Date.now()}`,
      text: resolution || 'Resolved',
      userId,
      createdAt: new Date().toISOString(),
      type: 'RESOLUTION',
    });
    return this.provider.updateException(exceptionId, {
      status: 'RESOLVED',
      resolvedBy: userId,
      resolvedAt: new Date().toISOString(),
      comments: ex.comments,
      updatedAt: new Date().toISOString(),
    });
  }

  review(exceptionId, { userId, status = 'IN_REVIEW' }) {
    return this.provider.updateException(exceptionId, {
      status,
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

module.exports = { ExceptionService };
