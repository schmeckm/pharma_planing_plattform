# MVP 3.0 — Enterprise Architecture
## AI-Assisted Global Allocation Platform

**Status:** Architecture Design (Target State)  
**Baseline:** MVP 1.0 (Rules) + MVP 2.0 (Enterprise)  
**Edition:** MVP 3.0 — AI-Assisted Global Allocation  
**GMP Context:** GxP-aware design; AI assists decisions, humans retain accountability

---

## 1. Strategic Positioning

| Dimension | MVP 1.0 | MVP 2.0 | MVP 3.0 |
|-----------|---------|---------|---------|
| Paradigm | Rule execution | Enterprise workflow | AI-assisted decision platform |
| Time horizon | Now | Now + What-If | 7 / 30 / 90 days predictive |
| Intelligence | Deterministic rules | Risk scoring + Copilot (rules) | Multi-agent + Digital Twin |
| Data | JSON files | JSON + Provider abstraction | Twin + Knowledge Graph + Events |
| Users | Planners | Planners, QA, SC, Admin | + Executives, Agents (autonomous) |

### Vision Statement

Transform hard allocation from reactive rule-checking into **proactive, explainable, globally optimized** pharmaceutical supply chain decision-making — with full GMP traceability and human-in-the-loop governance.

---

## 2. Reference Architecture (TOGAF-aligned)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPERIENCE LAYER                                     │
│  Planner Cockpit │ Executive Cockpit │ AI Copilot │ Agent Console           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ GraphQL / REST / WebSocket
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                      API & ORCHESTRATION GATEWAY                             │
│  /api/v1  /api/v2  /api/v3  │  Auth (RBAC)  │  Rate Limit  │  Audit        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  APPLICATION  │         │   AI / AGENT    │         │   ANALYTICS     │
│   SERVICES    │         │     LAYER       │         │    LAYER        │
│ Allocation    │         │ Planning Agent  │         │ Predictive Risk │
│ Digital Twin  │         │ QA Agent        │         │ Optimization    │
│ Exceptions    │         │ SC Agent        │         │ Executive KPIs  │
│ Rules         │         │ Compliance Agent│         │ Heatmaps        │
│ Jobs          │         │ LangGraph Orch. │         │                 │
└───────┬───────┘         └────────┬────────┘         └────────┬────────┘
        │                          │                           │
        └──────────────────────────┼───────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOMAIN & ENGINE LAYER                                │
│  Rule Engine │ FIFO │ Sequencing │ Risk │ Copilot │ Twin Simulator           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  KNOWLEDGE    │         │  EVENT BUS      │         │  DATA PROVIDERS │
│  GRAPH        │         │  Kafka / Mesh   │         │  Json / SAP     │
│  (Neo4j)      │         │                 │         │  OData / RFC    │
└───────────────┘         └─────────────────┘         └─────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SAP S/4HANA + Packing + GTS + QM                          │
│  Packaging Orders │ Sales Orders │ Batch │ Inventory │ TRIC │ Inspection    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Domain Bounded Contexts

| Context | Responsibility | MVP 3.0 Component |
|---------|----------------|-------------------|
| **Allocation** | Hard allocation decisions | Existing v1/v2 engines + Global Optimizer |
| **Compliance** | TRIC, RMSL, GMP rules | Compliance Agent + Rule Engine |
| **Inventory** | Batch availability, plants | Supply Chain Agent + Twin |
| **Planning** | Order sequencing, timing | Planning Agent + Digital Twin |
| **Quality** | Release, inspection lots | QA Agent |
| **Intelligence** | Predictions, explanations | Predictive Risk + AI Copilot |
| **Governance** | Audit, RBAC, signatures | Existing v2 + GxP extensions (MVP 5) |

---

## 4. Digital Supply Chain Twin

### Purpose
Virtual synchronized model of orders, inventory, batches, plants, markets, and rules — enabling forward simulation.

### Twin State Model

```typescript
TwinSnapshot {
  timestamp: ISO8601
  horizonDays: 7 | 30 | 90
  entities: {
    salesOrders[], packagingOrders[], batches[],
    plants[], markets[], countryRules[]
  }
  projections: {
    allocationOutcomes[], riskEvents[],
    rmslViolations[], shortages[]
  }
}
```

### Simulation Horizons

| Horizon | Use Case | Engine |
|---------|----------|--------|
| T+7 | Daily planning, urgent orders | `digitalTwinEngine.simulate(7)` |
| T+30 | Monthly supply review | `digitalTwinEngine.simulate(30)` |
| T+90 | Strategic inventory positioning | `digitalTwinEngine.simulate(90)` |

### GMP Considerations
- Twin runs are **non-GxP** (decision support only)
- All production allocations require human approval until MVP 5 e-signature workflow
- Twin projections logged in audit trail with `executionMode: TWIN_SIMULATE`

---

## 5. Technology Stack (MVP 3.0 Target)

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, PrimeVue, Chart.js, D3 (heatmap) |
| API | Node.js 20, Express, `/api/v3` |
| Agents | LangGraph (orchestration), MCP tools |
| Graph | Neo4j 5.x |
| Events | Apache Kafka (on-prem) or SAP Event Mesh (BTP) |
| ML/Risk | Python microservice (optional Phase 3.1) or Node heuristics |
| SAP | OData V4, RFC/BAPI, Event Mesh adapters |
| Infra | Docker Compose → Kubernetes (MVP 4) |

---

## 6. Non-Functional Requirements

| NFR | Target |
|-----|--------|
| Availability | 99.5% (business hours critical) |
| Twin simulation (T+7) | < 30s for 500 orders |
| Copilot response | < 3s (cached graph queries) |
| Audit retention | 7 years (pharma standard) |
| Data residency | EU/US region isolation |
| AI explainability | Every agent action cites rule checks + graph paths |

---

## 7. Security & GMP Governance

- **Human-in-the-loop:** Agents recommend; planners/QA approve
- **Segregation of duties:** QA Agent cannot execute allocations
- **Audit chain:** Agent → Recommendation → Human Action → SAP Posting
- **Validated state:** MVP 3.0 = decision support (non-validated); MVP 5 = GxP validation package

---

## 8. Migration Path from MVP 2.0

1. Deploy Neo4j + populate graph from existing JSON/SAP
2. Introduce `/api/v3` alongside v1/v2 (no breaking changes)
3. Enable event bus in shadow mode (consume, don't act)
4. Activate Planning Agent in **recommend-only** mode
5. Executive Cockpit reads from Predictive Risk + Twin APIs
6. Gradual agent autonomy increase per role approval matrix

See [09-ROADMAP-MVP3-TO-MVP5.md](./09-ROADMAP-MVP3-TO-MVP5.md) for phased delivery.
