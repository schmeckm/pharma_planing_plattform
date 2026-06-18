/**
 * LLM Agent Service — enriches rule-based agents with RAG + LLM reasoning.
 * Learns from audit trail and approve/dismiss feedback.
 */
const { chat, isLlmConfigured, isLlmAgentsEnabled, getLlmStatus, getConfig } = require('./llmClient');
const { getLearningStore } = require('./learningStore');
const { createToolRegistry, summarizeToolsForPrompt } = require('../../agents/toolRegistry');
const { generateId } = require('../../utils/idGenerator');

const SYSTEM_PROMPT = `You are a pharmaceutical supply chain planning agent for Hard Allocation.
You MUST:
- Ground every recommendation in the provided DATA, RULE-BASED RECOMMENDATIONS, and LEARNING CONTEXT only.
- Never invent batch IDs, order IDs, or lot IDs not present in the input.
- Output valid JSON only.
- Set confidence 0.0-1.0 based on evidence strength.
- Mark requiresApproval true for all actions.
- Prefer patterns from APPROVED past decisions; avoid patterns from DISMISSED ones.

Output JSON schema:
{
  "recommendations": [
    {
      "agentId": "planning-agent|qa-agent|supply-chain-agent|compliance-agent",
      "type": "STRING",
      "targetId": "string",
      "packagingOrderId": "string or null",
      "action": "string",
      "rationale": "string",
      "impact": "string",
      "confidence": 0.0-1.0,
      "approverRole": "PLANNER|QA|SUPPLY_CHAIN",
      "evidence": ["string"]
    }
  ],
  "summary": "one paragraph daily briefing",
  "scheduleExplanation": "optional: 2-3 sentences on solver status, constraints, and schedule if SCHEDULING EVIDENCE is present",
  "reasoningTrace": "brief chain-of-thought for audit"
}`;

const BRIEFING_PROMPT = `You are a pharmaceutical production planning advisor for Hard Allocation.
Explain the current schedule and constraint evidence to a human planner in plain language.
You MUST:
- Use only SCHEDULING EVIDENCE and DAILY SUMMARY data provided — never invent order IDs or batch IDs.
- Mention solver status, constraint pass/fail counts, and top risks if any.
- Do NOT suggest re-running optimization — the planner decides when to optimize.
- Write in the user's locale language (LOCALE field).
- Output valid JSON only.

Output JSON schema:
{
  "scheduleExplanation": "2-4 sentences explaining the plan, constraints, and solver result",
  "llmSummary": "one paragraph morning briefing for the planner",
  "reasoningTrace": "brief audit trace"
}`;

class LlmAgentService {
  constructor(intelligenceHooks) {
    this.hooks = intelligenceHooks;
    this.store = getLearningStore();
    this.tools = createToolRegistry({
      simulateTwin: intelligenceHooks.simulateTwin,
      getPredictions: intelligenceHooks.getPredictions,
      getOrders: intelligenceHooks.getOrders,
      getBatches: intelligenceHooks.getBatches,
      getExceptions: intelligenceHooks.getExceptions,
    });
  }

  async ensureIndexed() {
    if (process.env.RAG_ENABLED === 'false') return { skipped: true };
    if (this.store.chunks.length < 10) {
      return this.store.indexAuditTrail(parseInt(process.env.RAG_AUDIT_LIMIT || '200', 10));
    }
    return { total: this.store.chunks.length };
  }

  async reindex(options = {}) {
    const audit = await this.store.indexAuditTrail(options.auditLimit || 500);
    return { audit, stats: this.store.getStats() };
  }

  _compactContext(context) {
    const orders = context.orders || [];
    const open = orders.filter((o) => o.status === 'OPEN' || o.status === 'PLANNED');
    const twin = context.twinProjection?.projections?.summary || {};
    const atRisk = context.twinProjection?.projections?.allocationOutcomes
      ?.filter((o) => o.projectedStatus === 'FAILED')
      ?.slice(0, 15) || [];

    return {
      trigger: context.trigger,
      horizonDays: context.horizonDays,
      openOrders: open.length,
      twinSummary: twin,
      atRiskOrders: atRisk,
      openExceptions: (context.exceptions || []).filter((e) => e.status === 'OPEN').length,
      pendingLots: (context.inspectionLots || []).filter((l) => l.status === 'PENDING' || l.status === 'IN_PROGRESS').length,
      rmslHigh: context.predictions?.horizons?.[0]?.rmslViolations?.filter((v) => v.severity === 'HIGH')?.slice(0, 10) || [],
      expiringBatches: (context.batches || []).filter((b) => (b.remainingShelfLifeMonths || 99) < 6).slice(0, 10)
        .map((b) => ({ batchId: b.batchId, rmsl: b.remainingShelfLifeMonths })),
      scheduling: context.schedulingEvidence ? {
        engine: context.schedulingEvidence.engine,
        solverStatus: context.schedulingEvidence.solverStatus,
        constraintSummary: context.schedulingEvidence.constraintSummary,
        kpis: context.schedulingEvidence.kpis,
        topPriority: context.schedulingEvidence.topPriority,
        blockedSample: context.schedulingEvidence.blockedSample,
        sequenceSample: context.schedulingEvidence.sequenceSample,
        fromCache: context.schedulingEvidence.fromCache,
      } : null,
    };
  }

  async explainScheduleBriefing(dailySummary, context = {}) {
    if (!isLlmAgentsEnabled()) {
      return null;
    }

    const cfg = getConfig();
    const evidence = context.schedulingEvidence;
    if (!evidence) return null;

    try {
      await this.ensureIndexed();

      const query = [
        'schedule explanation',
        evidence.solverStatus,
        evidence.engine,
      ].join(' ');

      const { contextText } = await this.store.buildRagContext(query, 4);
      const compact = this._compactContext(context);

      const userPrompt = `LOCALE: ${context.locale || 'en'}

DAILY SUMMARY (rule-based):
${JSON.stringify(dailySummary?.summary || dailySummary, null, 2)}

SCHEDULING EVIDENCE (OR-Tools / constraints — explain only, do not re-optimize):
${JSON.stringify(evidence, null, 2)}

OPERATIONAL CONTEXT:
${JSON.stringify(compact, null, 2)}

LEARNING CONTEXT:
${contextText || '(none)'}

Explain the plan for the planner. Reference concrete constraint counts and solver status.`;

      const llmOut = await chat(
        [
          { role: 'system', content: BRIEFING_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        { json: true, temperature: 0.2 },
      );

      return {
        scheduleExplanation: llmOut.scheduleExplanation || llmOut.llmSummary || null,
        llmSummary: llmOut.llmSummary || llmOut.scheduleExplanation || null,
        reasoningTrace: llmOut.reasoningTrace || null,
        llmMode: cfg.mode,
      };
    } catch (err) {
      console.error('[LLM Briefing]', err.message);
      if (cfg.fallbackToRules) return null;
      throw err;
    }
  }

  async enrichAgentRun(ruleResult, context) {
    if (!isLlmAgentsEnabled() || ruleResult.status === 'DISABLED') {
      return { ...ruleResult, llmMode: 'rules-only' };
    }

    const cfg = getConfig();
    try {
      await this.ensureIndexed();

      const query = [
        'allocation planning',
        context.trigger,
        ...(ruleResult.recommendations || []).slice(0, 3).map((r) => r.action),
      ].join(' ');

      const { contextText, citations } = await this.store.buildRagContext(query, 8);
      const compact = this._compactContext({ ...context, trigger: ruleResult.trigger });

      const userPrompt = `TRIGGER: ${ruleResult.trigger}
LOCALE: ${context.locale || 'en'}

OPERATIONAL DATA:
${JSON.stringify(compact, null, 2)}

RULE-BASED RECOMMENDATIONS (baseline — refine or extend, do not contradict compliance):
${JSON.stringify((ruleResult.recommendations || []).slice(0, 20), null, 2)}

SCHEDULING EVIDENCE (solver + constraints — explain in summary, do not re-optimize):
${JSON.stringify(context.schedulingEvidence || null, null, 2)}

LEARNING CONTEXT (past audit decisions and planner feedback):
${contextText || '(no indexed learning data yet — run POST /api/v3/llm/reindex)'}

AVAILABLE TOOLS (already reflected in data above):
${summarizeToolsForPrompt(this.tools)}

Produce JSON with recommendations array. Include evidence citing LEARNING CONTEXT ids where relevant.`;

      const llmOut = await chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        { json: true, temperature: 0.15 },
      );

      const llmRecs = (llmOut.recommendations || []).map((r) => ({
        recommendationId: generateId('REC'),
        agentId: r.agentId || 'planning-agent',
        agent: (r.agentId || 'planning-agent').replace(/-agent$/, '').replace(/-/g, ' '),
        type: r.type || 'LLM_SUGGESTION',
        targetId: r.targetId,
        packagingOrderId: r.packagingOrderId,
        action: r.action,
        rationale: r.rationale,
        impact: r.impact,
        confidence: Math.min(1, Math.max(0, Number(r.confidence) || 0.75)),
        priority: (Number(r.confidence) || 0.75) >= 0.85 ? 'HIGH' : 'MEDIUM',
        evidence: [...(r.evidence || []), ...citations.map((c) => `learning:${c.id}`)],
        requiresApproval: true,
        approverRole: r.approverRole || 'PLANNER',
        status: (Number(r.confidence) || 0.75) < 0.7 ? 'NEEDS_REVIEW' : 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
        source: 'llm',
      }));

      const merged = this._mergeRecommendations(ruleResult.recommendations || [], llmRecs);

      return {
        ...ruleResult,
        llmMode: cfg.mode,
        engine: 'HybridRules+LLM',
        reasoningTrace: llmOut.reasoningTrace || null,
        ragCitations: citations,
        recommendations: merged,
        totalRecommendations: merged.length,
        dailySummary: ruleResult.dailySummary
          ? {
              ...ruleResult.dailySummary,
              llmSummary: llmOut.summary,
              scheduleExplanation: llmOut.scheduleExplanation
                || (context.schedulingEvidence
                  ? `Solver ${context.schedulingEvidence.solverStatus} via ${context.schedulingEvidence.engine}.`
                  : null),
              advisorNote: `${ruleResult.dailySummary.advisorNote || ''} LLM-enriched (human approval required).`.trim(),
            }
          : ruleResult.dailySummary,
        advisorNote: 'LLM + rule-based recommendations — planner approval required. Grounded on audit learning index.',
      };
    } catch (err) {
      console.error('[LLM Agent]', err.message);
      if (cfg.fallbackToRules) {
        return {
          ...ruleResult,
          llmMode: 'rules-fallback',
          llmError: err.message,
        };
      }
      throw err;
    }
  }

  _mergeRecommendations(ruleRecs, llmRecs) {
    const seen = new Set(ruleRecs.map((r) => `${r.type}:${r.targetId}`));
    const merged = [...ruleRecs];
    for (const r of llmRecs) {
      const key = `${r.type}:${r.targetId}`;
      if (seen.has(key)) {
        const idx = merged.findIndex((x) => `${x.type}:${x.targetId}` === key);
        if (idx >= 0 && r.source === 'llm') {
          merged[idx] = {
            ...merged[idx],
            rationale: r.rationale,
            action: r.action,
            impact: r.impact || merged[idx].impact,
            evidence: [...new Set([...(merged[idx].evidence || []), ...(r.evidence || [])])],
            llmEnriched: true,
          };
        }
      } else {
        merged.push(r);
        seen.add(key);
      }
    }
    return merged.slice(0, 40);
  }

  async askCopilot(question, context = {}) {
    if (!isLlmConfigured() || getConfig().mode === 'rules-only') {
      return null;
    }

    await this.ensureIndexed();
    const { contextText, citations } = await this.store.buildRagContext(question, 6);

    const userPrompt = `QUESTION: ${question}
ORDER CONTEXT: ${JSON.stringify(context.order || null)}
SIMULATION: ${JSON.stringify(context.result || null)}
RULE CHECKS: ${JSON.stringify((context.ruleChecks || []).slice(0, 15))}
LEARNING CONTEXT:
${contextText}

Answer in the same language as the question. Cite learning context when relevant. Be concise.`;

    const answer = await chat(
      [
        { role: 'system', content: 'Pharmaceutical allocation copilot. Only use provided data. Never invent IDs.' },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2 },
    );

    return {
      answer,
      engine: 'LLM+RAG',
      ragCitations: citations,
      evidence: citations.map((c) => `learning:${c.id}`),
    };
  }

  recordFeedback(recommendation) {
    return this.store.indexRecommendationFeedback(recommendation);
  }

  getStatus() {
    return {
      ...getLlmStatus(),
      learning: this.store.getStats(),
    };
  }
}

module.exports = { LlmAgentService };
