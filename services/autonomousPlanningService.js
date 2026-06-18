const fs = require('node:fs');
const path = require('node:path');
const { getProvider } = require('../providers');
const { DailyPlanningService } = require('./dailyPlanningService');
const { LineOptimizationService } = require('./lineOptimizationService');
const { AllocationService } = require('./allocationService');
const { AutonomyPolicyEngine, DEFAULT_POLICY } = require('../engines/autonomyPolicyEngine');
const { ActionExecutor } = require('../agents/actionExecutor');
const { generateId } = require('../utils/idGenerator');
const { getEventBus } = require('../events/eventService');

class AutonomousPlanningService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.dailyPlanning = new DailyPlanningService();
    this.lineOpt = new LineOptimizationService();
    this.allocation = new AllocationService();
    this.policy = new AutonomyPolicyEngine(this._loadPolicy());
    this.executor = new ActionExecutor({
      lineOptimizationService: this.lineOpt,
      allocationService: this.allocation,
      dailyPlanningService: this.dailyPlanning,
      provider: this.provider,
    });
  }

  _dataDir() {
    return process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
  }

  _loadPolicy() {
    try {
      const p = path.join(this._dataDir(), 'autopilotPolicy.json');
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return {
        ...DEFAULT_POLICY,
        ...raw,
        tiers: { ...DEFAULT_POLICY.tiers, ...(raw.tiers || {}) },
      };
    } catch {
      return { ...DEFAULT_POLICY };
    }
  }

  _savePolicy(policy) {
    const p = path.join(this._dataDir(), 'autopilotPolicy.json');
    fs.writeFileSync(p, JSON.stringify(policy, null, 2));
    this.policy = new AutonomyPolicyEngine(policy);
    return policy;
  }

  _appendRun(run) {
    const p = path.join(this._dataDir(), 'autopilotRuns.json');
    let data = { runs: [] };
    try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { /* new */ }
    data.runs = [run, ...(data.runs || [])].slice(0, 50);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return run;
  }

  getStatus() {
    const p = path.join(this._dataDir(), 'autopilotRuns.json');
    let lastRun = null;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      lastRun = data.runs?.[0] || null;
    } catch { /* none */ }

    const pol = this.policy.getPolicy();
    return {
      enabled: pol.enabled,
      policy: pol,
      lastRun,
      advisorNote:
        'Tiered autonomy: LOW risk → auto draft + optional confirm. MEDIUM → draft only. HIGH → planner review. Hard allocation only when policy allowHardAllocation=true.',
    };
  }

  getRuns(limit = 20) {
    const p = path.join(this._dataDir(), 'autopilotRuns.json');
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return { total: data.runs?.length || 0, runs: (data.runs || []).slice(0, limit) };
    } catch {
      return { total: 0, runs: [] };
    }
  }

  updatePolicy(patch) {
    const current = this.policy.getPolicy();
    const merged = {
      ...current,
      ...patch,
      tiers: patch.tiers ? { ...current.tiers, ...patch.tiers } : current.tiers,
    };
    return this._savePolicy(merged);
  }

  async runAutopilot({ userId = 'AUTOPILOT', dryRun = false, maxOrders = null } = {}) {
    const startedAt = new Date().toISOString();
    const runId = generateId('AUTO');
    const policy = this.policy.getPolicy();

    if (!policy.enabled) {
      return { runId, status: 'DISABLED', message: 'Autopilot is disabled in policy' };
    }

    const limit = maxOrders || policy.maxOrdersPerRun;
    const openOrders = this.provider.getOrders({ status: 'OPEN' });
    const recommended = await this.dailyPlanning.getRecommendedSequence({ forceRefresh: false });
    const sequence = (recommended.sequence || []).slice(0, limit);
    const seqEval = this.policy.evaluateSequence(sequence);

    const actions = [];
    const escalations = [];

    if (seqEval.autoExecute && !dryRun) {
      const seqResult = this.executor.execute('AUTO_SEQUENCE', { sequence }, userId);
      actions.push({ ...seqResult, confidence: seqEval.confidence, tier: seqEval.tier });

      if (seqEval.autoConfirm) {
        const confirmResult = this.executor.execute(
          'AUTO_CONFIRM_SEQUENCE',
          { sequence, label: 'Autopilot — LOW risk auto-confirm' },
          userId,
        );
        actions.push({ ...confirmResult, confidence: seqEval.confidence, tier: seqEval.tier });
      }
    } else if (seqEval.autoExecute && dryRun) {
      actions.push({
        action: 'AUTO_SEQUENCE',
        executed: false,
        dryRun: true,
        wouldExecute: true,
        wouldConfirm: seqEval.autoConfirm,
        itemCount: sequence.length,
        confidence: seqEval.confidence,
        tier: seqEval.tier,
      });
    } else {
      escalations.push({
        action: 'AUTO_SEQUENCE',
        reason: 'Sequence tier gate — planner review required',
        confidence: seqEval.confidence,
        tier: seqEval.tier,
        blockers: seqEval.blockers,
        humanRequired: true,
      });
    }

    const orderIds = sequence
      .map((o) => o.packagingOrder || o.packagingOrderId)
      .filter(Boolean);

    let autoAllocated = 0;
    let autoHard = 0;
    let escalatedAlloc = 0;

    for (const poId of orderIds) {
      const order = this.provider.getOrderById(poId) || openOrders.find((o) => o.packagingOrderId === poId);
      let simResult;
      try {
        simResult = this.allocation.simulate({ packagingOrderId: poId, userId });
      } catch (err) {
        escalations.push({
          action: 'AUTO_ALLOCATE',
          packagingOrderId: poId,
          reason: err.message,
          confidence: 0,
          tier: 'HIGH',
          humanRequired: true,
        });
        escalatedAlloc += 1;
        continue;
      }

      const allocEval = this.policy.evaluateAllocation(simResult, order);

      if (allocEval.autoExecute && !dryRun) {
        const result = this.executor.execute('AUTO_ALLOCATE', { packagingOrderId: poId, simResult }, userId);
        actions.push({
          ...result,
          confidence: allocEval.confidence,
          tier: allocEval.tier,
          riskLevel: allocEval.riskLevel,
        });
        autoAllocated += 1;

        if (allocEval.autoHardAllocate) {
          const hard = this.executor.execute(
            'AUTO_HARD_ALLOCATE',
            {
              packagingOrderId: poId,
              simResult,
              allowHardAllocation: policy.allowHardAllocation,
            },
            userId,
          );
          actions.push({
            ...hard,
            confidence: allocEval.confidence,
            tier: allocEval.tier,
            riskLevel: allocEval.riskLevel,
          });
          if (hard.executed) autoHard += 1;
        }
      } else if (allocEval.autoExecute && dryRun) {
        actions.push({
          action: 'AUTO_ALLOCATE',
          packagingOrderId: poId,
          executed: false,
          dryRun: true,
          wouldExecute: true,
          wouldHardAllocate: allocEval.autoHardAllocate,
          batchId: allocEval.recommendedBatchId,
          confidence: allocEval.confidence,
          tier: allocEval.tier,
          riskLevel: allocEval.riskLevel,
        });
        autoAllocated += 1;
      } else {
        escalations.push({
          action: 'AUTO_ALLOCATE',
          packagingOrderId: poId,
          reason: allocEval.humanRequired
            ? `${allocEval.tier} risk — planner approval required`
            : 'Allocation policy gate',
          confidence: allocEval.confidence,
          tier: allocEval.tier,
          riskLevel: allocEval.riskLevel,
          blockers: allocEval.blockers,
          humanRequired: true,
        });
        escalatedAlloc += 1;
      }
    }

    const completedAt = new Date().toISOString();
    const run = {
      runId,
      status: 'COMPLETED',
      dryRun,
      autonomyMode: policy.autonomyMode,
      startedAt,
      completedAt,
      triggeredBy: userId,
      summary: {
        totalOrders: orderIds.length,
        sequenceAuto: seqEval.autoExecute,
        sequenceConfirmed: seqEval.autoConfirm && seqEval.autoExecute,
        autoAllocated,
        autoHardAllocated: autoHard,
        escalated: escalations.length,
        escalatedAlloc,
        openOrders: openOrders.length,
      },
      sequenceEvaluation: seqEval,
      actions,
      escalations,
      policy: {
        minConfidence: policy.minConfidence,
        allowedActions: policy.allowedActions,
        allowHardAllocation: policy.allowHardAllocation,
        tiers: policy.tiers,
      },
      advisorNote: dryRun
        ? 'Dry run — no data written.'
        : policy.allowHardAllocation
          ? 'Tiered run complete. LOW-risk drafts may include hard allocation; MEDIUM/HIGH escalated to planner.'
          : 'Draft sequence and batch assignments saved. Confirm in Production Sequencing; hard allocation needs planner.',
    };

    this._appendRun(run);
    getEventBus().publish('hap.autopilot.run', { type: 'AUTOPILOT_COMPLETED', data: { runId, summary: run.summary } });

    return run;
  }
}

module.exports = { AutonomousPlanningService };
