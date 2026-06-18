const path = require('path');
const { JsonRepository } = require('../utils/jsonRepository');
const { loadOrdersData } = require('../utils/ordersData');
const { IDataProvider } = require('./IDataProvider');

class JsonProvider extends IDataProvider {
  constructor(dataDir = process.env.HAP_DATA_DIR || path.join(__dirname, '..', 'data')) {
    super();
    this.repo = new JsonRepository(dataDir);
  }

  getProviderName() { return 'JsonProvider'; }

  getProviderInfo() {
    return {
      name: 'JsonProvider',
      connected: true,
      mode: 'json',
      dataDir: this.repo.dataDir,
      description: 'Local JSON file store for MVP development',
    };
  }

  getOrders(filters = {}) {
    const data = loadOrdersData(this.repo);
    const salesMap = Object.fromEntries((data.salesOrders || []).map((s) => [s.salesOrderId, s]));
    return (data.packagingOrders || [])
      .filter((o) => !filters.status || o.status === filters.status)
      .filter((o) => !filters.country || o.destinationCountry === filters.country)
      .map((o) => ({ ...o, salesOrder: salesMap[o.salesOrderId] || null }));
  }

  getOrderById(id) {
    return this.getOrders().find((o) => o.packagingOrderId === id) || null;
  }

  updateOrder(id, updates) {
    const data = loadOrdersData(this.repo);
    const idx = data.packagingOrders.findIndex((o) => o.packagingOrderId === id);
    if (idx === -1) return null;
    data.packagingOrders[idx] = { ...data.packagingOrders[idx], ...updates };
    this.repo.write('orders', data);
    this.repo.writeArray('packagingOrders', data.packagingOrders);
    return data.packagingOrders[idx];
  }

  getBatches(filters = {}) {
    return this.repo.readArray('batches').filter((b) => {
      if (filters.materialNumber && b.materialNumber !== filters.materialNumber) return false;
      if (filters.qualityStatus && b.qualityStatus !== filters.qualityStatus) return false;
      return true;
    });
  }

  updateBatch(id, updates) {
    return this.repo.updateInArray('batches', 'batchId', id, updates);
  }

  getRules(filters = {}) {
    const rulesV2 = this.repo.read('rulesV2');
    if (rulesV2) {
      let rules = rulesV2.rules || [];
      if (filters.category) rules = rules.filter((r) => r.category === filters.category);
      if (filters.activeOnly) rules = rules.filter((r) => r.active !== false);
      return { ...rulesV2, rules };
    }
    return this.repo.read('rules') || { countryRules: [], ruleDefinitions: [] };
  }

  getRuleById(id) {
    const data = this.getRules();
    return (data.rules || []).find((r) => r.ruleId === id) || null;
  }

  saveRule(rule) {
    const data = this.repo.read('rulesV2') || { rules: [], versions: [], auditLog: [] };
    const idx = data.rules.findIndex((r) => r.ruleId === rule.ruleId);
    if (idx >= 0) data.rules[idx] = rule;
    else data.rules.push(rule);
    this.repo.write('rulesV2', data);
    return rule;
  }

  getRuleVersions(ruleId) {
    const data = this.repo.read('rulesV2') || { versions: [] };
    return (data.versions || []).filter((v) => v.ruleId === ruleId);
  }

  saveRuleVersion(ruleId, version) {
    const data = this.repo.read('rulesV2') || { rules: [], versions: [], auditLog: [] };
    data.versions = data.versions || [];
    data.versions.push(version);
    data.auditLog = data.auditLog || [];
    data.auditLog.push({
      action: 'VERSION_CREATED',
      ruleId,
      version: version.version,
      timestamp: new Date().toISOString(),
      userId: version.createdBy,
    });
    this.repo.write('rulesV2', data);
    return version;
  }

  appendRuleAudit(entry) {
    const data = this.repo.read('rulesV2') || { auditLog: [] };
    data.auditLog = data.auditLog || [];
    data.auditLog.push({ ...entry, timestamp: new Date().toISOString() });
    this.repo.write('rulesV2', data);
  }

  getAuditTrail(filters = {}) {
    const all = this.repo.readArray('auditTrail');
    let entries = [...all].reverse();
    if (filters.packagingOrderId) entries = entries.filter((e) => e.packagingOrderId === filters.packagingOrderId);
    if (filters.status) entries = entries.filter((e) => e.status === filters.status);
    if (filters.limit) entries = entries.slice(0, filters.limit);
    return { total: all.length, entries };
  }

  appendAudit(entry) {
    return this.repo.appendToArray('auditTrail', entry);
  }

  getExceptions(filters = {}) {
    let items = this.repo.readArray('exceptions');
    if (filters.status) items = items.filter((e) => e.status === filters.status);
    if (filters.type) items = items.filter((e) => e.type === filters.type);
    if (filters.severity) items = items.filter((e) => e.severity === filters.severity);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateException(id, updates) {
    return this.repo.updateInArray('exceptions', 'exceptionId', id, updates);
  }

  createException(exception) {
    return this.repo.appendToArray('exceptions', exception);
  }

  getJobs(filters = {}) {
    let jobs = this.repo.readArray('jobs');
    if (filters.status) jobs = jobs.filter((j) => j.status === filters.status);
    return jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getJobById(id) {
    return this.repo.findInArray('jobs', 'jobId', id);
  }

  saveJob(job) {
    const existing = this.getJobById(job.jobId);
    if (existing) {
      return this.repo.updateInArray('jobs', 'jobId', job.jobId, job);
    }
    return this.repo.appendToArray('jobs', job);
  }

  getUsers() {
    return this.repo.readArray('users');
  }

  getUserById(id) {
    return this.repo.findInArray('users', 'userId', id);
  }

  updateUser(userId, updates) {
    return this.repo.updateInArray('users', 'userId', userId, updates);
  }

  getWhatIfScenarios() {
    return this.repo.readArray('whatIfScenarios');
  }

  saveWhatIfScenario(scenario) {
    return this.repo.appendToArray('whatIfScenarios', scenario);
  }

  getHistoricalPerformance() {
    const perf = this.repo.read('linePerformance');
    if (perf?.items?.length) return perf;
    return this.repo.read('historicalPerformance') || { items: [] };
  }

  getLinePerformance(filters = {}) {
    const data = this.getHistoricalPerformance();
    let items = data.items || [];
    if (filters.materialNumber) items = items.filter((i) => i.materialNumber === filters.materialNumber);
    if (filters.lineId) items = items.filter((i) => i.lineId === filters.lineId);
    if (filters.productFamily) items = items.filter((i) => i.productFamily === filters.productFamily);
    return { ...data, items };
  }

  getPlanningExceptions(filters = {}) {
    let items = this.repo.readArray('planningExceptions');
    if (filters.status) items = items.filter((e) => e.status === filters.status);
    if (filters.type) items = items.filter((e) => e.type === filters.type);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getProductionLines() {
    return this.repo.readArray('productionLines');
  }

  getProductionLineById(lineId) {
    return this.repo.findInArray('productionLines', 'lineId', lineId);
  }

  updateProductionLine(lineId, updates) {
    return this.repo.updateInArray('productionLines', 'lineId', lineId, updates);
  }

  getSequenceState() {
    const rules = this.repo.read('rules');
    return rules?.sequenceState || {};
  }

  saveSequenceState(state) {
    const rules = this.repo.read('rules') || {};
    rules.sequenceState = state;
    this.repo.write('rules', rules);
  }
}

module.exports = { JsonProvider };
