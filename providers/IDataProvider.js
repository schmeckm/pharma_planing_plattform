/**
 * IDataProvider — abstraction for data access (JSON MVP / SAP OData future).
 * All services must consume data through this interface.
 */
class IDataProvider {
  // Orders & Inventory
  getOrders(filters) { throw new Error('Not implemented'); }
  getOrderById(id) { throw new Error('Not implemented'); }
  updateOrder(id, updates) { throw new Error('Not implemented'); }
  getBatches(filters) { throw new Error('Not implemented'); }
  updateBatch(id, updates) { throw new Error('Not implemented'); }

  // Rules
  getRules(filters) { throw new Error('Not implemented'); }
  getRuleById(id) { throw new Error('Not implemented'); }
  saveRule(rule) { throw new Error('Not implemented'); }
  getRuleVersions(ruleId) { throw new Error('Not implemented'); }
  saveRuleVersion(ruleId, version) { throw new Error('Not implemented'); }

  // Audit & Exceptions
  getAuditTrail(filters) { throw new Error('Not implemented'); }
  appendAudit(entry) { throw new Error('Not implemented'); }
  getExceptions(filters) { throw new Error('Not implemented'); }
  updateException(id, updates) { throw new Error('Not implemented'); }
  createException(exception) { throw new Error('Not implemented'); }

  // Jobs
  getJobs(filters) { throw new Error('Not implemented'); }
  getJobById(id) { throw new Error('Not implemented'); }
  saveJob(job) { throw new Error('Not implemented'); }

  // Auth
  getUsers() { throw new Error('Not implemented'); }
  getUserById(id) { throw new Error('Not implemented'); }
  updateUser(id, updates) { throw new Error('Not implemented'); }

  // What-If
  getWhatIfScenarios() { throw new Error('Not implemented'); }
  saveWhatIfScenario(scenario) { throw new Error('Not implemented'); }

  appendRuleAudit(entry) { throw new Error('Not implemented'); }

  getHistoricalPerformance() { throw new Error('Not implemented'); }
  getLinePerformance() { return this.getHistoricalPerformance(); }
  getProductionLines() { throw new Error('Not implemented'); }
  getProductionLineById(id) { throw new Error('Not implemented'); }
  updateProductionLine(id, updates) { throw new Error('Not implemented'); }
  getPlanningExceptions(filters) { throw new Error('Not implemented'); }

  getProviderName() { return 'unknown'; }
  getProviderInfo() {
    return { name: this.getProviderName(), connected: true, mode: 'mock' };
  }
}

module.exports = { IDataProvider };
