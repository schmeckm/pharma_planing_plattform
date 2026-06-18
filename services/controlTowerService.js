const fs = require('fs');
const path = require('path');
const { getProvider } = require('../providers');
const { IntelligenceService } = require('./intelligenceService');
const { RecommendationEngine } = require('../engines/recommendationEngine');
const { remainingShelfLifeMonths } = require('../utils/dateUtils');
const { generateId } = require('../utils/idGenerator');

class ControlTowerService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.intelligence = new IntelligenceService(provider);
    this.recommendationEngine = new RecommendationEngine();
  }

  _dataDir() {
    return process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
  }

  _readJson(name) {
    try {
      const p = path.join(this._dataDir(), `${name}.json`);
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return data.items || data;
    } catch {
      return [];
    }
  }

  getGlobalInventory() {
    const batches = this.provider.getBatches();
    const bulk = this._readJson('bulkInventory');
    const plants = this._readJson('plants');
    const ref = new Date();

    const finishedGoods = batches.map((b) => {
      const total = b.quantity ?? b.availableQuantity ?? 0;
      const avail = b.availableQuantity ?? 0;
      const allocated = Math.max(0, total - avail);
      const rmsl = remainingShelfLifeMonths(b.expiryDate, ref);
      return {
        ...b,
        inventoryType: 'FINISHED_GOODS',
        allocatedQuantity: allocated,
        blockedQuantity: b.qualityStatus === 'BLOCKED' ? avail : 0,
        remainingShelfLifeMonths: rmsl,
        markets: b.approvedCountries || [],
      };
    });

    const byPlant = this._groupSum(finishedGoods, 'plant', 'availableQuantity');
    const byCountry = {};
    finishedGoods.forEach((b) => {
      (b.markets || []).forEach((c) => {
        byCountry[c] = (byCountry[c] || 0) + b.availableQuantity;
      });
    });
    const byMaterial = this._groupSum(finishedGoods, 'materialNumber', 'availableQuantity');
    const byBatch = finishedGoods;

    const totals = {
      available: finishedGoods.reduce((s, b) => s + b.availableQuantity, 0)
        + bulk.reduce((s, b) => s + b.availableQuantity, 0),
      allocated: finishedGoods.reduce((s, b) => s + b.allocatedQuantity, 0)
        + bulk.reduce((s, b) => s + (b.allocatedQuantity || 0), 0),
      blocked: finishedGoods.reduce((s, b) => s + b.blockedQuantity, 0)
        + bulk.reduce((s, b) => s + (b.blockedQuantity || 0), 0),
    };

    return {
      timestamp: ref.toISOString(),
      totals,
      finishedGoods: { byPlant, byCountry, byMaterial, byBatch, items: finishedGoods },
      bulkInventory: { items: bulk, byPlant: this._groupSum(bulk, 'plantId', 'availableQuantity') },
      plants,
    };
  }

  getMarketDemand() {
    const packagingOrders = this.provider.getOrders();
    let sales = [];
    try {
      const rawOrders = JSON.parse(
        fs.readFileSync(path.join(this._dataDir(), 'orders.json'), 'utf-8'),
      );
      sales = rawOrders.salesOrders || [];
    } catch {
      sales = this._readJson('salesOrders');
    }
    const forecasts = this._readJson('forecasts');
    const markets = this._readJson('markets');

    const openDemand = sales.reduce((s, o) => s + o.quantity, 0);
    const forecastTotal = forecasts.reduce((s, f) => s + f.forecastQuantity, 0);

    const byCountry = {};
    sales.forEach((so) => {
      if (!byCountry[so.destinationCountry]) {
        byCountry[so.destinationCountry] = { countryCode: so.destinationCountry, salesOrders: 0, quantity: 0, backorders: 0 };
      }
      byCountry[so.destinationCountry].salesOrders += 1;
      byCountry[so.destinationCountry].quantity += so.quantity;
    });

    const blockedPOs = packagingOrders.filter((o) => o.status === 'OPEN');
    blockedPOs.forEach((po) => {
      if (byCountry[po.destinationCountry]) byCountry[po.destinationCountry].backorders += 1;
    });

    const byCustomer = {};
    sales.forEach((so) => {
      if (!byCustomer[so.customerName]) byCustomer[so.customerName] = { customer: so.customerName, quantity: 0, orders: 0 };
      byCustomer[so.customerName].quantity += so.quantity;
      byCustomer[so.customerName].orders += 1;
    });

    const byProduct = this._groupSum(sales, 'materialNumber', 'quantity');

    return {
      timestamp: new Date().toISOString(),
      summary: { openDemand, forecastTotal, salesOrderCount: sales.length, packagingOrderCount: packagingOrders.length },
      salesOrders: sales,
      forecasts,
      markets,
      byCountry: Object.values(byCountry),
      byCustomer: Object.values(byCustomer),
      byProduct,
    };
  }

  getAllocationMonitor() {
    const orders = this.provider.getOrders();
    const auditData = this.provider.getAuditTrail({ limit: 20 });
    const auditEntries = auditData.entries || [];

    const allocated = orders.filter((o) => o.allocatedBatchId);
    const open = orders.filter((o) => o.status === 'OPEN' && !o.allocatedBatchId);
    const simulated = auditEntries
      .filter((a) => a.executionMode === 'SIMULATE').slice(-10);
    const blocked = open.filter((o) => {
      const batches = this.provider.getBatches({ materialNumber: o.materialNumber, qualityStatus: 'RELEASED' });
      return !batches.some((b) => b.approvedCountries?.includes(o.destinationCountry));
    });

    return {
      timestamp: new Date().toISOString(),
      summary: {
        allocated: allocated.length,
        open: open.length,
        blocked: blocked.length,
        simulated: simulated.length,
        pendingDecisions: open.length,
      },
      allocatedOrders: allocated,
      openOrders: open,
      blockedOrders: blocked,
      recentSimulations: simulated,
      pendingDecisions: open.map((o) => ({
        packagingOrderId: o.packagingOrderId,
        destinationCountry: o.destinationCountry,
        plannedStartDate: o.plannedStartDate,
        quantity: o.quantity,
      })),
    };
  }

  getRiskControlCenter(horizonDays = 30) {
    const twin = this.intelligence.simulateTwin(horizonDays);
    const predictions = this.intelligence.getPredictions([7, 30, 90]);
    const batches = this.provider.getBatches();
    const rules = this.provider.getRules();
    const ref = new Date();

    const rmslRisks = twin.projections.rmslViolations || [];
    const expiryRisks = batches
      .filter((b) => remainingShelfLifeMonths(b.expiryDate, ref) < 6)
      .map((b) => ({
        batchId: b.batchId,
        materialNumber: b.materialNumber,
        remainingShelfLifeMonths: remainingShelfLifeMonths(b.expiryDate, ref),
        availableQuantity: b.availableQuantity,
        riskLevel: remainingShelfLifeMonths(b.expiryDate, ref) < 3 ? 'HIGH' : 'MEDIUM',
      }));

    const countryRules = rules.countryRules || [];
    const complianceRisks = (twin.projections.atRiskMarkets || []).map((m) => ({
      countryCode: m.countryCode,
      riskLevel: m.riskLevel,
      orderCount: m.orderCount,
      type: 'RMSL_COMPLIANCE',
    }));

    const heatmap = twin.projections.atRiskMarkets.map((m) => ({
      countryCode: m.countryCode,
      riskLevel: m.riskLevel,
      orderCount: m.orderCount,
      // digitalTwinEngine writes the country code into `country`, not `destinationCountry`.
      rmslViolations: rmslRisks.filter(
        (r) => r.country === m.countryCode || r.destinationCountry === m.countryCode,
      ).length,
    }));

    const bottlenecks = (predictions.horizons?.[0]?.bottlenecks || [])
      .concat(this._readJson('packagingCapacity').filter((c) => c.utilizationPercent > 85).map((c) => ({
        type: 'PACKAGING_CAPACITY',
        plantId: c.plantId,
        utilizationPercent: c.utilizationPercent,
        riskLevel: c.utilizationPercent > 90 ? 'HIGH' : 'MEDIUM',
      })));

    return {
      horizonDays,
      timestamp: ref.toISOString(),
      overallRisk: predictions.overallRisk,
      heatmap,
      rmslRisks,
      expiryRisks,
      complianceRisks,
      batchShortages: predictions.horizons?.[0]?.marketShortages || [],
      bottlenecks,
    };
  }

  getExecutiveDashboard(horizonDays = 7) {
    const inventory = this.getGlobalInventory();
    const allocation = this.getAllocationMonitor();
    const risk = this.getRiskControlCenter(horizonDays);
    const demand = this.getMarketDemand();
    const twin = this.intelligence.simulateTwin(horizonDays);

    const totalOrders = twin.projections.summary.totalOrders || 1;
    const successRate = Math.round((twin.projections.summary.projectedSuccess / totalOrders) * 1000) / 10;

    return {
      horizonDays,
      timestamp: new Date().toISOString(),
      kpis: {
        serviceLevel: 96.8,
        inventoryCoverage: Math.round(inventory.totals.available / (demand.summary.openDemand || 1) * 10) / 10,
        allocationSuccessRate: successRate,
        rmslCompliance: successRate,
        marketFillRate: Math.round((allocation.summary.allocated / (allocation.summary.allocated + allocation.summary.open || 1)) * 1000) / 10,
        inventoryAtRisk: inventory.totals.blocked + risk.expiryRisks.reduce((s, r) => s + r.availableQuantity, 0),
        globalRisk: risk.overallRisk,
        openExceptions: (this.provider.getExceptions?.({ status: 'OPEN' }) || []).length,
      },
      trends: {
        inventoryByPlant: inventory.finishedGoods.byPlant,
        demandByCountry: demand.byCountry,
        riskHeatmap: risk.heatmap,
      },
    };
  }

  getEvents(limit = 50) {
    const events = this._readJson('controlTowerEvents');
    return {
      timestamp: new Date().toISOString(),
      total: events.length,
      items: [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit),
    };
  }

  appendEvent(event) {
    const p = path.join(this._dataDir(), 'controlTowerEvents.json');
    let data = { items: [] };
    try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { /* new */ }
    const entry = {
      eventId: generateId('EVT'),
      timestamp: new Date().toISOString(),
      ...event,
    };
    data.items.unshift(entry);
    data.items = data.items.slice(0, 200);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return entry;
  }

  getDigitalTwin(horizonDays = 7) {
    return this.intelligence.simulateTwin(horizonDays);
  }

  getRecommendations() {
    const orders = this.provider.getOrders();
    const batches = this.provider.getBatches();
    const bulk = this._readJson('bulkInventory');
    const lots = this._readJson('inspectionLots');
    const predictions = this.intelligence.getPredictions([7, 30, 90]);
    const capacity = this._readJson('packagingCapacity');
    return {
      timestamp: new Date().toISOString(),
      recommendations: this.recommendationEngine.generate(orders, batches, bulk, lots, predictions, capacity),
    };
  }

  getUnifiedDashboard(horizonDays = 7) {
    const { PlanningImpactService } = require('./planningImpactService');
    const planningImpact = new PlanningImpactService().getPlanningImpact({
      groupBy: 'productPortfolio',
      scope: 'all',
      horizonDays,
      sinceDays: horizonDays,
    });
    return {
      timestamp: new Date().toISOString(),
      horizonDays,
      executive: this.getExecutiveDashboard(horizonDays),
      inventory: this.getGlobalInventory(),
      demand: this.getMarketDemand(),
      allocation: this.getAllocationMonitor(),
      risk: this.getRiskControlCenter(horizonDays),
      events: this.getEvents(10),
      recommendations: this.getRecommendations(),
      digitalTwin: this.getDigitalTwin(horizonDays),
      planningImpact,
    };
  }

  _groupSum(items, key, valueKey) {
    const map = {};
    items.forEach((item) => {
      const k = item[key] || 'UNKNOWN';
      map[k] = (map[k] || 0) + (item[valueKey] || 0);
    });
    return map;
  }
}

module.exports = { ControlTowerService };
