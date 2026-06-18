const { IDataProvider } = require('./IDataProvider');

/**
 * SAP OData Provider — mock implementation for future SAP integration.
 * Maps OData entity sets to platform domain objects.
 */
class SAPODataProvider extends IDataProvider {
  constructor(config = {}) {
    super();
    this.baseUrl = config.baseUrl || process.env.SAP_ODATA_URL || 'https://sap-mock.example.com/sap/opu/odata/sap';
    this.client = config.client || '100';
    this._connected = false;
  }

  getProviderName() { return 'SAPODataProvider'; }

  async connect() {
    // Mock connection handshake
    this._connected = true;
    return { connected: true, system: 'SAP S/4HANA Mock', client: this.client };
  }

  _ensureConnected() {
    if (!this._connected) this.connect();
  }

  // Mock OData responses — replace with real HTTP calls
  _mockOrders() {
    return [
      {
        packagingOrderId: 'FG-SAP-90001',
        salesOrderId: 'SO-SAP-80001',
        materialNumber: 'DP-1000',
        materialDescription: 'Product Alpha 100mg (SAP)',
        destinationCountry: 'DE',
        quantity: 2500,
        unit: 'EA',
        status: 'OPEN',
        plannedStartDate: '2026-06-25',
        plant: '1000',
        source: 'SAP_ODATA',
      },
    ];
  }

  getOrders(filters = {}) {
    this._ensureConnected();
    let orders = this._mockOrders();
    if (filters.status) orders = orders.filter((o) => o.status === filters.status);
    return orders;
  }

  getOrderById(id) {
    return this.getOrders().find((o) => o.packagingOrderId === id) || null;
  }

  updateOrder(id, updates) {
    console.log(`[SAP Mock] BAPI_ALLO_CONFIRM for ${id}`, updates);
    return { ...this.getOrderById(id), ...updates, sapConfirmed: true };
  }

  getBatches() {
    this._ensureConnected();
    return [
      {
        batchId: 'BATCH-SAP-001',
        materialNumber: 'DP-1000',
        availableQuantity: 10000,
        qualityStatus: 'RELEASED',
        approvedCountries: ['DE', 'GB'],
        source: 'SAP_ODATA',
      },
    ];
  }

  updateBatch(id, updates) {
    console.log(`[SAP Mock] Inventory update for ${id}`, updates);
    return { batchId: id, ...updates };
  }

  getRules() {
    return { rules: [], source: 'SAP_CDS_MOCK' };
  }

  getRuleById() { return null; }
  saveRule(rule) { console.log('[SAP Mock] Rule publish', rule.ruleId); return rule; }
  getRuleVersions() { return []; }
  saveRuleVersion(ruleId, version) { return version; }

  getAuditTrail() { return { total: 0, entries: [] }; }
  appendAudit(entry) { console.log('[SAP Mock] Audit', entry.decisionId); return entry; }

  getExceptions() { return []; }
  updateException(id, updates) { return { exceptionId: id, ...updates }; }
  createException(ex) { return ex; }

  getJobs() { return []; }
  getJobById() { return null; }
  saveJob(job) { return job; }

  getUsers() { return []; }
  updateUser() { throw new Error('Not implemented in SAP provider'); }
  getUserById() { return null; }

  getWhatIfScenarios() { return []; }
  saveWhatIfScenario(s) { return s; }

  appendRuleAudit(entry) {
    console.log('[SAP Mock] Rule audit', entry.action, entry.ruleId);
    return entry;
  }

  getHistoricalPerformance() {
    return {
      items: [
        {
          materialNumber: 'DP-1000',
          lineId: 'PACK_LINE_01',
          runs: 120,
          averageOee: 81.0,
          averageThroughput: 450,
          averageYield: 97.5,
          averageSetupMinutes: 40,
          reliability: 95.0,
          source: 'SAP_MII_MOCK',
        },
      ],
    };
  }

  getProductionLines() {
    return [
      { lineId: 'PACK_LINE_01', lineName: 'SAP Packaging Line 01', plantId: '1000', performanceFactor: 1.0 },
    ];
  }

  getProductionLineById(lineId) {
    return this.getProductionLines().find((l) => l.lineId === lineId) || null;
  }

  updateProductionLine(lineId, updates) {
    console.log('[SAP Mock] updateProductionLine (no-op)', lineId, Object.keys(updates || {}));
    const line = this.getProductionLineById(lineId);
    return line ? { ...line, ...updates } : null;
  }

  getLinePerformance() {
    return this.getHistoricalPerformance();
  }

  getPlanningExceptions() {
    return [];
  }

  getSequenceState() {
    return {};
  }

  saveSequenceState(state) {
    console.log('[SAP Mock] saveSequenceState (no-op)', Object.keys(state || {}).length, 'markets');
    return state;
  }

  getProviderInfo() {
    return {
      name: 'SAPODataProvider',
      connected: this._connected,
      mode: 'mock',
      baseUrl: this.baseUrl,
      client: this.client,
      entitySets: [
        'A_PackagingOrder',
        'A_BatchStock',
        'A_CountryRule',
        'A_SalesOrder',
        'A_PackingMapping',
      ],
      description: 'Mock SAP OData provider — no live SAP connection',
    };
  }

  /** OData entity set metadata (mock) */
  getEntitySets() {
    return {
      PackagingOrders: `${this.baseUrl}/A_PackagingOrder`,
      BatchStock: `${this.baseUrl}/A_BatchStock`,
      CountryRules: `${this.baseUrl}/A_CountryRule`,
    };
  }
}

module.exports = { SAPODataProvider };
