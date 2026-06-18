/**
 * Learning store — RAG over audit trail + agent feedback (approve/dismiss).
 * Persists embeddings + text chunks to JSON. Learns from planner decisions.
 */
const fs = require('node:fs');
const path = require('node:path');
const { embed, isLlmConfigured } = require('./llmClient');
const { generateId } = require('../../utils/idGenerator');

function dataDir() {
  return process.env.HAP_DATA_DIR || path.join(__dirname, '../../data');
}

function indexPath() {
  return path.join(dataDir(), 'agentLearningIndex.json');
}

function cosine(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function keywordScore(query, text) {
  const q = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const t = text.toLowerCase();
  return q.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
}

class LearningStore {
  constructor() {
    this.chunks = [];
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(indexPath(), 'utf-8');
      const data = JSON.parse(raw);
      this.chunks = data.chunks || [];
    } catch {
      this.chunks = [];
    }
  }

  _save() {
    const dir = dataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      indexPath(),
      JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), chunks: this.chunks }, null, 2),
    );
  }

  async _addChunk({ source, sourceId, text, metadata, outcome }) {
    if (!text?.trim()) return null;
    const chunk = {
      id: generateId('LRN'),
      source,
      sourceId: sourceId || null,
      text: text.slice(0, 4000),
      metadata: metadata || {},
      outcome: outcome || null,
      createdAt: new Date().toISOString(),
      embedding: null,
    };

    if (isLlmConfigured() && process.env.RAG_ENABLED !== 'false') {
      const vectors = await embed(chunk.text);
      if (vectors?.[0]) chunk.embedding = vectors[0];
    }

    this.chunks.unshift(chunk);
    const max = parseInt(process.env.RAG_MAX_CHUNKS || '2000', 10);
    if (this.chunks.length > max) this.chunks = this.chunks.slice(0, max);
    this._save();
    return chunk;
  }

  async indexAuditTrail(limit = 300) {
    const p = path.join(dataDir(), 'auditTrail.json');
    let items = [];
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      items = data.items || data || [];
    } catch {
      return { indexed: 0 };
    }

    const recent = items.slice(-limit);
    let indexed = 0;
    for (const entry of recent) {
      const exists = this.chunks.some((c) => c.source === 'audit' && c.sourceId === entry.decisionId);
      if (exists) continue;

      const text = [
        `Decision ${entry.decisionId}`,
        entry.packagingOrderId ? `Order ${entry.packagingOrderId}` : '',
        entry.batchId ? `Batch ${entry.batchId}` : '',
        entry.status ? `Status ${entry.status}` : '',
        entry.riskLevel ? `Risk ${entry.riskLevel}` : '',
        entry.explanation || '',
        ...(entry.failureReasons || []),
        ...(entry.ruleChecks || []).map((r) => `${r.ruleId}: ${r.message || r.status}`),
      ].filter(Boolean).join('. ');

      await this._addChunk({
        source: 'audit',
        sourceId: entry.decisionId,
        text,
        metadata: {
          packagingOrderId: entry.packagingOrderId,
          batchId: entry.batchId,
          userId: entry.userId,
        },
        outcome: entry.status === 'SUCCESS' ? 'success' : entry.status === 'FAILED' ? 'failed' : 'neutral',
      });
      indexed++;
    }
    return { indexed, total: this.chunks.length };
  }

  async indexRecommendationFeedback(recommendation) {
    if (!recommendation) return null;
    const text = [
      `Agent ${recommendation.agentId || recommendation.agent}`,
      `Type ${recommendation.type}`,
      recommendation.packagingOrderId ? `Order ${recommendation.packagingOrderId}` : '',
      `Action: ${recommendation.action}`,
      `Rationale: ${recommendation.rationale}`,
      recommendation.dismissReason ? `Dismiss reason: ${recommendation.dismissReason}` : '',
    ].join('. ');

    return this._addChunk({
      source: 'recommendation',
      sourceId: recommendation.recommendationId,
      text,
      metadata: {
        agentId: recommendation.agentId,
        packagingOrderId: recommendation.packagingOrderId,
        type: recommendation.type,
      },
      outcome: recommendation.status === 'APPROVED' ? 'approved' : recommendation.status === 'DISMISSED' ? 'dismissed' : 'pending',
    });
  }

  async search(query, topK = 8) {
    const k = parseInt(process.env.RAG_TOP_K || String(topK), 10);
    if (!this.chunks.length) return [];

    if (isLlmConfigured() && process.env.RAG_ENABLED !== 'false') {
      const vectors = await embed(query);
      const qv = vectors?.[0];
      if (qv) {
        return this.chunks
          .filter((c) => c.embedding?.length)
          .map((c) => ({ chunk: c, score: cosine(qv, c.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, k)
          .map(({ chunk, score }) => ({ ...chunk, score }));
      }
    }

    return this.chunks
      .map((c) => ({ ...c, score: keywordScore(query, c.text) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async buildRagContext(query, topK = 6) {
    const hits = await this.search(query, topK);
    if (!hits.length) return { contextText: '', citations: [] };
    const lines = hits.map((h, i) => {
      const label = h.outcome ? `[${h.outcome}]` : `[${h.source}]`;
      return `${i + 1}. ${label} ${h.text.slice(0, 400)}`;
    });
    return {
      contextText: lines.join('\n'),
      citations: hits.map((h) => ({ id: h.id, source: h.source, sourceId: h.sourceId, outcome: h.outcome })),
    };
  }

  getStats() {
    const bySource = {};
    const byOutcome = {};
    for (const c of this.chunks) {
      bySource[c.source] = (bySource[c.source] || 0) + 1;
      if (c.outcome) byOutcome[c.outcome] = (byOutcome[c.outcome] || 0) + 1;
    }
    return {
      totalChunks: this.chunks.length,
      withEmbeddings: this.chunks.filter((c) => c.embedding?.length).length,
      bySource,
      byOutcome,
      indexPath: indexPath(),
    };
  }
}

let _instance;
function getLearningStore() {
  if (!_instance) _instance = new LearningStore();
  return _instance;
}

module.exports = { LearningStore, getLearningStore };
