# Roadmap: MVP 3.0 → MVP 5.0

## Release Timeline Overview

```
2026 Q3    MVP 3.0  AI-Assisted Global Allocation (this document)
2026 Q4    MVP 3.1  LLM Copilot + Neo4j production
2027 Q1    MVP 4.0  Autonomous Agents (approved actions)
2027 Q2    MVP 4.5  Full SAP write-back + Event Mesh
2027 Q3    MVP 5.0  GxP Validated Production System
```

---

## MVP 3.0 — AI-Assisted Global Allocation (Q3 2026)

**Theme:** Proactive intelligence, human-in-the-loop

| # | Capability | Deliverable |
|---|------------|-------------|
| 1 | Digital Supply Chain Twin | T+7/30/90 simulation API |
| 2 | AI Copilot v3 | Graph-aware explainable answers |
| 3 | Planning Agent | Recommend-only, scheduled runs |
| 4 | QA Agent | Inspection lot prioritization |
| 5 | Supply Chain Agent | Rebalancing recommendations |
| 6 | Predictive Risk Engine | 7/30/90 day forecasts |
| 7 | Global Optimization Engine | Multi-objective batch selection |
| 8 | Knowledge Graph | Neo4j schema + in-memory scaffold |
| 9 | Event Architecture | Kafka/Mesh adapters (shadow mode) |
| 10 | Executive Cockpit | Management dashboard |

**Exit criteria:**
- Twin T+7 for 500 orders < 30s
- 3 agent types producing audited recommendations
- Executive dashboard with heatmap
- Zero autonomous SAP writes

---

## MVP 3.1 — Intelligence Enhancement (Q4 2026)

- Neo4j production deployment
- Optional Azure OpenAI Copilot (hybrid mode)
- WebSocket agent notifications
- Python ML microservice for RMSL prediction
- Redis job queue (replace in-process)

---

## MVP 4.0 — Autonomous Operations (Q1 2027)

**Theme:** Approved autonomy with governance

| Capability | Description |
|------------|-------------|
| Semi-auto allocation | Planner pre-approves agent action rules |
| LangGraph production | Full multi-agent orchestration |
| Kafka production | Event-driven twin sync |
| Global optimizer v2 | OR-Tools / Gurobi integration |
| SAP OData read | Live orders, batches, TRIC |
| Multi-plant | Cross-plant optimization |

**Exit criteria:**
- 80% of routine allocations agent-recommended
- < 5% false positive rate on predictions
- SAP read latency P95 < 2s

---

## MVP 4.5 — SAP Native (Q2 2027)

- Allocation write-back via BAPI/OData
- SAP Event Mesh production subscriptions
- Packing system real-time integration
- SAP Fiori launchpad embedding
- SAP BTP deployment option

---

## MVP 5.0 — GxP Validated Platform (Q3 2027)

**Theme:** Regulated production deployment

| Requirement | Implementation |
|-------------|----------------|
| 21 CFR Part 11 | Electronic signatures on allocation |
| CSV | IQ/OQ/PQ validation package |
| Immutable audit | WORM storage / blockchain anchor |
| Role segregation | SAP GRC integration |
| Disaster recovery | RPO 1h, RTO 4h |
| AI governance | Validated AI change control |

**Exit criteria:**
- QA sign-off on validation package
- Production deployment at 2+ sites
- Regulatory inspection readiness

---

## Investment & Team (Indicative)

| MVP | Team Size | Duration | Key Hires |
|-----|-----------|----------|-----------|
| 3.0 | 6-8 FTE | 4 months | AI engineer, graph DBA |
| 4.0 | 10-12 FTE | 6 months | SAP integration, ML |
| 5.0 | 12-15 FTE | 6 months | CSV specialist, QA |

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| AI hallucination in Copilot | Rules-only default; evidence required |
| Graph-SAP sync lag | Staleness flag; SAP verify before execute |
| Agent over-automation | Recommend-only until MVP 4 approval matrix |
| GMP audit findings | Human accountability; full audit chain |
| Kafka ops complexity | Start with Event Mesh on BTP |

---

## Success Metrics (MVP 3.0)

| Metric | Target |
|--------|--------|
| Blocked orders detected proactively | > 70% before planner discovery |
| Copilot answer accuracy (user rating) | > 4.0/5.0 |
| Twin prediction accuracy (T+7) | > 85% vs actual |
| Agent recommendation acceptance | > 60% |
| Executive dashboard adoption | Weekly active by VP Supply Chain |
