const { JsonRepository } = require('../utils/jsonRepository');
const { AllocationEngine } = require('../engines/allocationEngine');
const { DataService } = require('./dataService');
const { AuditService } = require('./auditService');

class AllocationService {
  constructor(repository = new JsonRepository(), dataService = new DataService(repository)) {
    const auditService = new AuditService(repository);
    this.engine = new AllocationEngine({ repository, dataService, auditService });
  }

  simulate(params) {
    return this.engine.simulate(params);
  }

  execute(params) {
    return this.engine.execute(params);
  }

  massSimulate(params) {
    return this.engine.massSimulate(params);
  }

  release(params) {
    return this.engine.release(params);
  }

  massRelease(params) {
    return this.engine.massRelease(params);
  }
}

module.exports = { AllocationService };
