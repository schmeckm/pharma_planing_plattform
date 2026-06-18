const fs = require('node:fs');
const path = require('node:path');
const { getProvider } = require('../providers');
const { DigitalTwinEngine } = require('../engines/digitalTwinEngine');
const { PredictiveRiskEngine } = require('../engines/predictiveRiskEngine');
const { GlobalOptimizationEngine } = require('../engines/globalOptimizationEngine');
const { HistoricalPerformanceEngine } = require('../engines/historicalPerformanceEngine');
const { AgentOrchestrator } = require('../agents/orchestrator');
const { PlanningAgent } = require('../agents/planningAgent');
const { GraphRepository } = require('../knowledge-graph/graphRepository');
const { CopilotService } = require('./copilotService');
const { createAgentTranslator, parseLocale } = require('../utils/agentLocale');
const { LlmAgentService } = require('./llm/llmAgentService');
const { MlPrognosisEngine } = require('../engines/mlPrognosisEngine');
const { PerformanceService } = require('./performanceService');
const { SchedulingService } = require('./schedulingService');
const { publishAgentRun, publishRecommendationChange, getEventBus } = require('../events/eventService');

class IntelligenceService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.twinEngine = new DigitalTwinEngine(provider);
    this.predictiveEngine = new PredictiveRiskEngine();
    this.optimizer = new GlobalOptimizationEngine();
    this.orchestrator = new AgentOrchestrator();
    this.planningAgent = new PlanningAgent();
    this.graph = new GraphRepository();
    this.copilotV3 = new CopilotService(provider);
    this.llmAgents = new LlmAgentService({
      simulateTwin: (h) => this.simulateTwin(h),
      getPredictions: (h) => this.getPredictions(h),
      getOrders: () => this.provider.getOrders(),
      getBatches: () => this.provider.getBatches(),
      getExceptions: () => this.provider.getExceptions(),
    });
    this.performance = new PerformanceService(this.provider);
    this.scheduling = new SchedulingService(this.provider);
    this._mlCache = { at: 0, data: null };
    this._seedGraph();
    this.llmAgents.ensureIndexed().catch((e) => console.warn('[LLM] index bootstrap:', e.message));
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

  _seedGraph() {
    const orders = this.provider.getOrders();
    const batches = this.provider.getBatches();
    const rules = this.provider.getRules();
    const lines = this.provider.getProductionLines?.() || [];
    const inspectionLots = this._loadInspectionLots();
    const salesOrders = this._readOrdersFile().salesOrders || [];

    for (const l of lines) {
      const lineId = this.graph.addNode('Line', { lineId: l.lineId, lineName: l.lineName, plantId: l.plantId });
      const plantId = this.graph.addNode('Plant', { plantId: l.plantId || '1000' });
      this.graph.addRelationship(lineId, 'LOCATED_AT', plantId);
    }

    for (const so of salesOrders) {
      const soId = this.graph.addNode('SalesOrder', { salesOrderId: so.salesOrderId, ...so });
      const custId = this.graph.addNode('Customer', {
        customerName: so.customerName,
        destinationCountry: so.destinationCountry,
      });
      this.graph.addRelationship(soId, 'ORDERED_BY', custId);
      const mktId = this.graph.addNode('Market', { marketId: so.market, countryCode: so.destinationCountry });
      this.graph.addRelationship(soId, 'DESTINED_FOR', mktId);
    }

    for (const o of orders) {
      const poId = this.graph.addNode('PackagingOrder', { packagingOrderId: o.packagingOrderId, ...o });
      const cId = this.graph.addNode('Country', { countryCode: o.destinationCountry });
      this.graph.addRelationship(poId, 'SHIPPED_TO', cId);
      if (o.salesOrderId) {
        const soNode = this.graph.findNode('SalesOrder', 'salesOrderId', o.salesOrderId);
        const soId = soNode?.id || this.graph.addNode('SalesOrder', { salesOrderId: o.salesOrderId });
        this.graph.addRelationship(poId, 'FULFILLS', soId);
      }
      if (o.productionLine) {
        const lineNode = this.graph.findNode('Line', 'lineId', o.productionLine);
        if (lineNode) this.graph.addRelationship(poId, 'PRODUCED_ON', lineNode.id);
      }
      if (o.allocatedBatchId) {
        const batchNode = this.graph.findNode('Batch', 'batchId', o.allocatedBatchId);
        if (batchNode) this.graph.addRelationship(poId, 'ALLOCATED_TO', batchNode.id);
      }
    }

    for (const b of batches) {
      const bId = this.graph.addNode('Batch', { batchId: b.batchId, ...b });
      for (const c of b.approvedCountries || []) {
        const cId = this.graph.findNode('Country', 'countryCode', c)?.id
          || this.graph.addNode('Country', { countryCode: c });
        this.graph.addRelationship(bId, 'APPROVED_FOR', cId);
        const mktNode = this.graph.findNode('Market', 'countryCode', c);
        const mktId = mktNode?.id || this.graph.addNode('Market', { marketId: `MKT-${c}`, countryCode: c });
        this.graph.addRelationship(bId, 'SUPPLIED_BY', mktId);
      }
    }

    const jpOrders = orders
      .filter((o) => o.destinationCountry === 'JP')
      .sort((a, b) => (a.plannedStartDate || '').localeCompare(b.plannedStartDate || ''));
    for (let i = 1; i < jpOrders.length; i++) {
      const curr = this.graph.findNode('PackagingOrder', 'packagingOrderId', jpOrders[i].packagingOrderId);
      const prev = this.graph.findNode('PackagingOrder', 'packagingOrderId', jpOrders[i - 1].packagingOrderId);
      if (curr?.id && prev?.id) this.graph.addRelationship(curr.id, 'DEPENDS_ON', prev.id);
    }

    for (const lot of inspectionLots) {
      const lotId = this.graph.addNode('InspectionLot', {
        lotId: lot.lotId || lot.inspectionLotId,
        batchId: lot.batchId,
        status: lot.status,
      });
      const batchNode = this.graph.findNode('Batch', 'batchId', lot.batchId);
      if (batchNode) this.graph.addRelationship(lotId, 'INSPECTS', batchNode.id);
      if (lot.status === 'PENDING' || lot.status === 'IN_PROGRESS') {
        const blockedOrders = orders.filter((o) => o.materialNumber === lot.materialNumber && o.status === 'OPEN');
        for (const o of blockedOrders.slice(0, 1)) {
          const poNode = this.graph.findNode('PackagingOrder', 'packagingOrderId', o.packagingOrderId);
          if (poNode) this.graph.addRelationship(poNode.id, 'BLOCKED_BY', lotId);
        }
      }
    }

    const countryRules = rules.countryRules || this._readCountryRules();
    for (const rule of countryRules) {
      const ruleId = this.graph.addNode('Rule', {
        ruleId: `RULE-COUNTRY-${rule.countryCode}`,
        countryCode: rule.countryCode,
        rmslThresholdMonths: rule.rmslThresholdMonths,
      });
      const cId = this.graph.findNode('Country', 'countryCode', rule.countryCode)?.id
        || this.graph.addNode('Country', { countryCode: rule.countryCode });
      this.graph.addRelationship(cId, 'GOVERNED_BY', ruleId);
    }
  }

  _readOrdersFile() {
    try {
      const p = path.join(this._dataDir(), 'orders.json');
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return { salesOrders: [], packagingOrders: [] };
    }
  }

  _readCountryRules() {
    try {
      const p = path.join(this._dataDir(), 'rules.json');
      return JSON.parse(fs.readFileSync(p, 'utf-8')).countryRules || [];
    } catch {
      return [];
    }
  }

  _linePerformanceScores() {
    const engine = HistoricalPerformanceEngine.fromRepository(this.provider.getLinePerformance?.() || this.provider.getHistoricalPerformance());
    return engine.records.map((r) => ({
      ...r,
      ...engine.calculateLineScore(r),
      reason: 'Weighted: 30% OEE, 25% throughput, 20% reliability, 15% yield, 10% setup',
    }));
  }

  simulateTwin(horizonDays = 7) {
    return this.twinEngine.buildSnapshot(horizonDays);
  }

  getPredictions(horizons = [7, 30, 90]) {
    const orders = this.provider.getOrders();
    const batches = this.provider.getBatches();
    const rules = this.provider.getRules();
    const forecasts = this._readJson('forecasts');
    const lines = this.provider.getProductionLines?.() || [];
    const base = this.predictiveEngine.predict(orders, batches, rules, horizons, { lines });
    const ml = this._getMlPrognosisCached(horizons);
    return {
      ...base,
      forecastsUsed: forecasts.length,
      mlPrognosis: ml,
      engine: 'rules + statistical-ml-v1',
    };
  }

  _getMlPrognosisCached(horizons) {
    const key = horizons.join(',');
    const now = Date.now();
    if (this._mlCache?.key === key && this._mlCache.data && now - this._mlCache.at < 60000) {
      return this._mlCache.data;
    }
    const data = this.getMlPrognosis(horizons);
    this._mlCache = { at: now, key, data };
    return data;
  }

  getMlPrognosis(horizons = [7, 30, 90]) {
    const orders = this.provider.getOrders();
    const batches = this.provider.getBatches();
    const forecasts = this._readJson('forecasts');
    const lines = this.provider.getProductionLines?.() || [];
    const shiftAnalysis = this.performance.getHistoricalAnalysis();
    return MlPrognosisEngine.predict({
      orders,
      batches,
      forecasts,
      lines,
      shiftAnalysis,
      horizons,
    });
  }

  optimizeGlobal(objectives) {
    return this.optimizer.optimize(
      this.provider.getOrders({ status: 'OPEN' }),
      this.provider.getBatches(),
      this.provider.getRules(),
      objectives,
    );
  }

  _schedulingEvidence(startAnchor = process.env.PLANNING_ANCHOR || '2026-09-01') {
    return this.scheduling.getExplanationEvidence({ startAnchor });
  }

  async getDailyPlanningSummary(horizonDays = 7, locale = 'en', options = {}) {
    const twin = this.simulateTwin(horizonDays);
    const predictions = this.getPredictions([7, 30, 90]);
    const { t, agentName } = createAgentTranslator(locale);
    const schedulingEvidence = this._schedulingEvidence();
    const context = {
      orders: this.provider.getOrders(),
      batches: this.provider.getBatches(),
      exceptions: this.provider.getExceptions(),
      twinProjection: twin,
      predictions,
      inspectionLots: this._loadInspectionLots(),
      linePerformance: this._linePerformanceScores(),
      forecasts: this._readJson('forecasts'),
      horizonDays,
      locale,
      t,
      agentName,
      schedulingEvidence,
    };
    const dailySummary = this.planningAgent.buildDailySummary(context);

    const llmExplain = options.llmExplain !== false;
    if (llmExplain && this.llmAgents.getStatus().mode !== 'rules-only') {
      try {
        const explained = await this.llmAgents.explainScheduleBriefing(dailySummary, {
          ...context,
          schedulingEvidence,
        });
        if (explained) {
          return {
            ...dailySummary,
            scheduleExplanation: explained.scheduleExplanation,
            llmSummary: explained.llmSummary,
            llmMode: explained.llmMode,
          };
        }
      } catch (err) {
        console.warn('[Planning Briefing LLM]', err.message);
      }
    }

    return dailySummary;
  }

  async runAgents(trigger = 'SCHEDULED_DAILY', horizonDays = 7, locale = 'en', options = {}) {
    const twinProjection = this.simulateTwin(horizonDays);
    const predictions = this.getPredictions([7, 30, 90]);
    const exceptions = this.provider.getExceptions();
    const batches = this.provider.getBatches();

    const blockedOrders = twinProjection.projections.allocationOutcomes
      .filter((o) => o.projectedStatus === 'FAILED')
      .map((o) => ({
        packagingOrderId: o.packagingOrderId,
        waitingBatchId: batches.find((b) => b.materialNumber === o.materialNumber)?.batchId,
      }));

    const { t, agentName, locale: lang } = createAgentTranslator(locale);

    const schedulingEvidence = this._schedulingEvidence();

    const result = await this.orchestrator.run(trigger, {
      twinProjection,
      predictions,
      exceptions,
      orders: this.provider.getOrders(),
      batches,
      rules: this.provider.getRules(),
      horizonDays,
      inspectionLots: this._loadInspectionLots(),
      linePerformance: this._linePerformanceScores(),
      forecasts: this._readJson('forecasts'),
      blockedOrders,
      schedulingEvidence,
      locale: lang,
      t,
      agentName,
    });

    const enriched = options.llmEnrich === false
      ? { ...result, llmMode: 'rules-only' }
      : await this.llmAgents.enrichAgentRun(result, {
        twinProjection,
        predictions,
        exceptions,
        orders: this.provider.getOrders(),
        batches,
        horizonDays,
        locale: lang,
        inspectionLots: this._loadInspectionLots(),
        schedulingEvidence,
        trigger,
      });

    this._saveRecommendations(enriched);
    publishAgentRun({
      runId: enriched.runId,
      trigger,
      agentsRun: enriched.agentsRun,
      totalRecommendations: enriched.totalRecommendations,
      horizonDays,
      llmMode: enriched.llmMode,
    });
    return enriched;
  }

  async askCopilotV3(question, packagingOrderId, locale = 'en') {
    const { t } = createAgentTranslator(locale);
    const base = this.copilotV3.ask({ question, packagingOrderId });
    const graphContext = packagingOrderId
      ? this.graph.query({ type: 'ALLOCATION_EXPLAIN', orderId: packagingOrderId })
      : null;

    let llmLayer = null;
    try {
      llmLayer = await this.llmAgents.askCopilot(question, {
        order: base.order,
        result: base.result,
        ruleChecks: base.ruleChecks,
      });
    } catch (err) {
      llmLayer = { error: err.message };
    }

    const useLlmAnswer = llmLayer?.answer && !llmLayer.error;

    return {
      ...base,
      engine: useLlmAnswer ? 'CopilotV3-LLM+RAG' : 'CopilotV3-GraphAware',
      locale,
      answer: useLlmAnswer ? llmLayer.answer : base.answer,
      llmMode: this.llmAgents.getStatus().mode,
      ragCitations: llmLayer?.ragCitations || [],
      advisorNote: t('advisorNote.copilot'),
      graphContext,
      evidence: [
        ...(base.evidence || []),
        ...(llmLayer?.evidence || []),
        ...(graphContext ? [`Graph: order linked to ${graphContext.countries?.length || 0} country node(s)`] : []),
      ],
      suggestedQuestions: [
        'Why was this batch selected?',
        'Why was this line recommended?',
        'What happens if I move this order?',
        'What happens if I use another batch?',
        'What happens if I move to another line?',
      ],
    };
  }

  getExecutiveDashboard(horizonDays = 7, locale = 'en') {
    const { t, agentName } = createAgentTranslator(locale);
    const twin = this.simulateTwin(horizonDays);
    const predictions = this.getPredictions([7, 30, 90]);
    const exceptions = this.provider.getExceptions({ status: 'OPEN' });
    const batches = this.provider.getBatches();
    const schedulingEvidence = this._schedulingEvidence();
    const dailySummary = this.planningAgent.buildDailySummary({
      orders: this.provider.getOrders(),
      batches,
      exceptions: this.provider.getExceptions(),
      twinProjection: twin,
      predictions,
      inspectionLots: this._loadInspectionLots(),
      linePerformance: this._linePerformanceScores(),
      horizonDays,
      locale,
      t,
      agentName,
      schedulingEvidence,
    });

    const successRate = twin.projections.summary.totalOrders
      ? Math.round((twin.projections.summary.projectedSuccess / twin.projections.summary.totalOrders) * 1000) / 10
      : 100;

    const onTimeOrders = this.provider.getOrders().filter((o) => {
      if (!o.requestedDeliveryDate || !o.plannedEndDate) return true;
      return o.plannedEndDate <= o.requestedDeliveryDate;
    }).length;
    const totalOrders = this.provider.getOrders().length || 1;
    const serviceLevel = Math.round((onTimeOrders / totalOrders) * 1000) / 10;

    return {
      horizonDays,
      locale,
      advisorNote: t('advisorNote.executive'),
      kpis: {
        globalRisk: predictions.overallRisk,
        serviceLevel,
        inventoryExposure: batches
          .filter((b) => b.qualityStatus === 'RELEASED')
          .reduce((s, b) => s + b.availableQuantity, 0),
        inventoryExpiryRisk: batches.filter((b) => (b.remainingShelfLifeMonths || 99) < 6).length,
        rmslCompliance: dailySummary.summary.ordersAtRisk
          ? Math.max(0, 100 - dailySummary.summary.ordersAtRisk * 2)
          : 100,
        allocationSuccessRate: successRate,
        lineUtilization: twin.projections.summary.peakUtilization || 0,
        blockedOrders: twin.projections.summary.projectedFailed,
        openExceptions: exceptions.length,
        openOrders: dailySummary.summary.openOrders,
        ordersAtRisk: dailySummary.summary.ordersAtRisk,
      },
      heatmap: twin.projections.atRiskMarkets.map((m) => ({
        countryCode: m.countryCode,
        riskLevel: m.riskLevel,
        orderCount: m.orderCount,
      })),
      topRisks: predictions.horizons[0]?.rmslViolations?.slice(0, 5) || [],
      dailySummary: dailySummary.summary,
      agentRecommendations: this._loadRecommendations().slice(0, 15).map((r) => ({
        ...this._normalizeRecommendation(r),
        agent: agentName(r.agentId) || r.agent,
      })),
    };
  }

  getExecutiveKpis(horizonDays = 7) {
    return { kpis: this.getExecutiveDashboard(horizonDays).kpis };
  }

  getExecutiveHeatmap(horizonDays = 7) {
    return { heatmap: this.getExecutiveDashboard(horizonDays).heatmap };
  }

  getAgentRecommendations(status = null, locale = 'en') {
    const { agentName } = createAgentTranslator(locale);
    let items = this._loadRecommendations().map((r) => ({
      ...this._normalizeRecommendation(r),
      agent: agentName(r.agentId) || r.agent,
    }));
    if (status) items = items.filter((r) => r.status === status);
    return { total: items.length, recommendations: items };
  }

  approveRecommendation(recommendationId, userId = 'SYSTEM') {
    const updated = this._updateRecommendation(recommendationId, {
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
    });
    if (updated) {
      publishRecommendationChange({ recommendationId, status: 'APPROVED', userId });
      this.llmAgents.recordFeedback(updated).catch(() => {});
    }
    return updated;
  }

  dismissRecommendation(recommendationId, userId = 'SYSTEM', reason = '') {
    const updated = this._updateRecommendation(recommendationId, {
      status: 'DISMISSED',
      dismissedBy: userId,
      dismissedAt: new Date().toISOString(),
      dismissReason: reason,
    });
    if (updated) {
      publishRecommendationChange({ recommendationId, status: 'DISMISSED', userId, reason });
      this.llmAgents.recordFeedback(updated).catch(() => {});
    }
    return updated;
  }

  getLlmStatus() {
    return this.llmAgents.getStatus();
  }

  async reindexLearning(options = {}) {
    return this.llmAgents.reindex(options);
  }

  getGraphStats() {
    return this.graph.getStats();
  }

  getEventLog(limit = 50) {
    return { events: getEventBus().getLog(limit) };
  }

  _normalizeRecommendation(r) {
    return {
      ...r,
      agent: r.agent || (r.agentId || '').replace(/-agent$/, '').replace(/-/g, ' '),
      packagingOrderId: r.packagingOrderId || (String(r.targetId || '').startsWith('FG-') ? r.targetId : null),
      priority: r.priority || (r.confidence >= 0.85 ? 'HIGH' : r.confidence >= 0.75 ? 'MEDIUM' : 'LOW'),
    };
  }

  _updateRecommendation(recommendationId, updates) {
    const p = path.join(this._dataDir(), 'agentRecommendations.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const idx = (data.items || []).findIndex((r) => r.recommendationId === recommendationId);
    if (idx === -1) return null;
    data.items[idx] = { ...data.items[idx], ...updates };
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return this._normalizeRecommendation(data.items[idx]);
  }

  _loadInspectionLots() {
    return this._readJson('inspectionLots');
  }

  _saveRecommendations(result) {
    const p = path.join(this._dataDir(), 'agentRecommendations.json');
    let existing = { items: [] };
    try { existing = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { /* new */ }
    const normalized = (result.recommendations || []).map((r) => this._normalizeRecommendation(r));
    existing.items = [...normalized, ...existing.items].slice(0, 100);
    fs.writeFileSync(p, JSON.stringify(existing, null, 2));
  }

  getAgentsStatus(locale = 'en') {
    const { t, agentName } = createAgentTranslator(locale);
    const enabled = process.env.AGENTS_ENABLED !== 'false';
    const recs = this._loadRecommendations();
    const pending = recs.filter((r) => r.status === 'PENDING_APPROVAL' || r.status === 'NEEDS_REVIEW');
    return {
      enabled,
      locale: parseLocale(locale),
      llm: this.llmAgents.getStatus(),
      agents: [
        { id: 'planning', name: agentName('planning-agent'), label: t('agentLabels.planning'), role: 'PLANNER' },
        { id: 'qa', name: agentName('qa-agent'), label: t('agentLabels.qa'), role: 'QA' },
        { id: 'supplyChain', name: agentName('supply-chain-agent'), label: t('agentLabels.supplyChain'), role: 'SUPPLY_CHAIN' },
        { id: 'compliance', name: agentName('compliance-agent'), label: t('agentLabels.compliance'), role: 'QA' },
      ],
      pendingRecommendations: pending.length,
      lastRecommendations: recs.slice(0, 5).map((r) => ({
        ...this._normalizeRecommendation(r),
        agent: agentName(r.agentId) || r.agent,
      })),
    };
  }

  _loadRecommendations() {
    try {
      const p = path.join(this._dataDir(), 'agentRecommendations.json');
      return JSON.parse(fs.readFileSync(p, 'utf-8')).items || [];
    } catch { return []; }
  }
}

module.exports = { IntelligenceService };
