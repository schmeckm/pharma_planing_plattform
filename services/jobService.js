const { getProvider } = require('../providers');
const { generateId } = require('../utils/idGenerator');
const { NotFoundError } = require('../utils/errors');
const { AllocationService } = require('./allocationService');
const { ExceptionEngine } = require('../engines/exceptionEngine');
const { RiskEngine } = require('../engines/riskEngine');
const { ExceptionService } = require('./exceptionService');

class JobService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.allocationService = new AllocationService();
    this.exceptionEngine = new ExceptionEngine();
    this.riskEngine = new RiskEngine();
    this.exceptionService = new ExceptionService(provider);
    this._workers = new Map();
  }

  _ordersForPeriod(period) {
    const openOrders = this.provider.getOrders({ status: 'OPEN' });
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const endOfWeek = new Date(startOfDay);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const inRange = (dateStr, end) => {
      if (!dateStr) return period === 'DAILY';
      const d = new Date(dateStr);
      return d >= startOfDay && d < end;
    };

    if (period === 'WEEKLY') {
      const filtered = openOrders.filter((o) => inRange(o.plannedStartDate || o.releaseDate, endOfWeek));
      return filtered.length ? filtered : openOrders;
    }
    if (period === 'DAILY') {
      const filtered = openOrders.filter((o) => inRange(o.plannedStartDate || o.releaseDate, endOfDay));
      return filtered.length ? filtered : openOrders;
    }
    return openOrders;
  }

  createMassAllocationJob({ period = 'DAILY', orderIds = [], userId, execute = false }) {
    let targetOrders = orderIds;
    if (!targetOrders.length) {
      targetOrders = this._ordersForPeriod(period).map((o) => o.packagingOrderId);
    }

    const job = {
      jobId: generateId('JOB'),
      type: 'MASS_ALLOCATION',
      period,
      status: 'QUEUED',
      progress: 0,
      totalItems: targetOrders.length,
      processedItems: 0,
      successful: 0,
      failed: 0,
      execute,
      orderIds: targetOrders,
      results: [],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };

    this.provider.saveJob(job);
    this._scheduleJob(job.jobId);
    return job;
  }

  _scheduleJob(jobId) {
    setTimeout(() => this._processJob(jobId), 100);
  }

  _processJob(jobId) {
    const job = this.provider.getJobById(jobId);
    if (!job || job.status === 'COMPLETED' || job.status === 'FAILED') return;

    job.status = 'RUNNING';
    job.startedAt = job.startedAt || new Date().toISOString();
    this.provider.saveJob(job);

    const batchSize = 5;
    let index = job.processedItems || 0;

    const processBatch = () => {
      const current = this.provider.getJobById(jobId);
      if (!current || current.status === 'CANCELLED') return;

      const end = Math.min(index + batchSize, current.orderIds.length);

      for (let i = index; i < end; i++) {
        const orderId = current.orderIds[i];
        try {
          const result = current.execute
            ? this.allocationService.execute({ packagingOrderId: orderId, userId: current.createdBy })
            : this.allocationService.simulate({ packagingOrderId: orderId, userId: current.createdBy });

          if (result.status === 'FAILED') {
            current.failed++;
            const order = this.provider.getOrderById(orderId);
            const risk = result.risk || { level: 'HIGH', score: 70 };
            const exception = this.exceptionEngine.buildException({ order, result, risk, userId: current.createdBy });
            this.exceptionService.create(exception);
          } else {
            current.successful++;
          }
          current.results.push({ packagingOrderId: orderId, ...result });
        } catch (err) {
          current.failed++;
          current.results.push({ packagingOrderId: orderId, status: 'FAILED', error: err.message });
        }
        current.processedItems++;
      }

      current.progress = Math.round((current.processedItems / current.totalItems) * 100);
      index = end;

      if (current.processedItems >= current.totalItems) {
        current.status = 'COMPLETED';
        current.completedAt = new Date().toISOString();
        current.progress = 100;
      }

      this.provider.saveJob(current);

      if (current.status === 'RUNNING') {
        setTimeout(processBatch, 50);
      }
    };

    processBatch();
  }

  getJob(jobId) {
    const job = this.provider.getJobById(jobId);
    if (!job) throw new NotFoundError('Job', jobId);
    return job;
  }

  listJobs(filters = {}) {
    return this.provider.getJobs(filters);
  }

  cancelJob(jobId) {
    const job = this.getJob(jobId);
    if (job.status === 'COMPLETED') throw new Error('Job already completed');
    return this.provider.saveJob({ ...job, status: 'CANCELLED', completedAt: new Date().toISOString() });
  }
}

module.exports = { JobService };
