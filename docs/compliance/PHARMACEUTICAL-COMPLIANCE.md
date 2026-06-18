# Pharmaceutical Compliance Requirements

**Edition:** GMP Compliance-First Allocation  
**Rule Set Version:** 2.1.0

## Execution Priority (Mandatory)

All allocation decisions follow this strict order. **Later phases never override failed compliance gates.**

| Order | Phase | Rules | Hard Stop |
|-------|-------|-------|-----------|
| **1** | **Compliance** | Packing mapping, quality stock, inspection lot, ATP, reserved inventory, TRIC, RMSL, batch split | Yes |
| **2** | **Market Rules** | Japan sequence, country-specific market rules | Yes |
| **3** | **FIFO** | Oldest production date among compliant batches | No (selection) |
| **4** | **Optimization** | RMSL margin, service level scoring | No (selection) |

```
Order + Batch Candidate
        │
        ▼
┌───────────────────┐
│ 1. COMPLIANCE     │──FAIL──▶ BLOCK (explain + audit)
└─────────┬─────────┘
          │ PASS
          ▼
┌───────────────────┐
│ 2. MARKET RULES   │──FAIL──▶ BLOCK
└─────────┬─────────┘
          │ PASS
          ▼
┌───────────────────┐
│ 3. FIFO           │── select oldest compliant batch
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ 4. OPTIMIZATION   │── document selection rationale
└───────────────────┘
```

---

## GMP Requirements Matrix

| Requirement | Rule ID | Engine Method | SAP Integration |
|-------------|---------|---------------|-----------------|
| **ATP checks** | RULE-010 | `checkAtp()` | MD04 / ATP in SD |
| **Reserved inventory** | RULE-011 | `checkReservedInventory()` | Reservation (RESB) |
| **Quality stock** | RULE-008 | `checkQualityStock()` | Unrestricted use stock (MCHB) |
| **Inspection lot** | RULE-009 | `checkInspectionLot()` | QM QALS / QAVE |
| **PO→SO packing mapping** | RULE-007 | `checkPackingMapping()` | Custom Packing System |
| **TRIC approval** | RULE-002 | `checkTric()` | GTS / country approval |
| **RMSL threshold** | RULE-003 | `checkRmsl()` | Batch expiry (MCH1) |
| **Quality status** | RULE-001 | `checkQualityStatus()` | QM status |
| **Batch split** | RULE-004 | `checkBatchSplit()` | Country rule |
| **Japan sequence** | RULE-005 | `checkJapanSequence()` | Market rule |
| **FIFO** | RULE-006 | OptimizationEngine | Production date |
| **Optimization** | RULE-012 | OptimizationEngine | Scoring engine |

---

## Explainable Allocation Decisions

Every simulation and execution returns:

- `ruleChecks[]` — each rule with `phase`, `result`, `message`, `evidence`
- `executionPhases` — grouped COMPLIANCE / MARKET_RULES results
- `executionStrategy`: `COMPLIANCE_FIRST`
- `explanation` — human-readable narrative

**API:**

```bash
GET /api/v1/compliance/explain/PO-20001
GET /api/v1/compliance/priorities
```

---

## GMP Audit Trail

Every decision writes to `auditTrail.json` with:

| Field | Purpose |
|-------|---------|
| `decisionId` | Immutable unique ID |
| `timestamp` | ISO 8601 UTC |
| `userId` | Actor (21 CFR Part 11) |
| `salesOrderId` | SO traceability |
| `packingSystem` | PO→SO packing reference |
| `ruleSetVersion` | Active rule version (2.1.0) |
| `executionPriority` | Phase order applied |
| `executionPhases` | Phase-level pass/fail |
| `ruleChecks` | Full rule evidence |
| `explanation` | Business narrative |
| `gmpAudit.immutable` | Audit integrity flag |
| `executionMode` | SIMULATE or EXECUTE |

---

## Rule Versioning

| Layer | Version Source |
|-------|----------------|
| Runtime rules | `rules.json` → `ruleSetVersion: "2.1.0"` |
| Per-rule version | `ruleDefinitions[].version` |
| Enterprise rules | `rulesV2.json` → version history + audit log |

Rule changes require:
1. Version increment in `rulesV2.json`
2. Effective date (`effectiveFrom`)
3. Audit log entry (`appendRuleAudit`)
4. No retroactive change to historical `auditTrail` entries

---

## Data Files

| File | Purpose |
|------|---------|
| `packingMappings.json` | PO → SO via Packing System |
| `atpReservations.json` | Active inventory reservations |
| `inspectionLots.json` | SAP QM inspection lots |
| `rules.json` | Rule definitions + `ruleSetVersion` |
| `auditTrail.json` | GMP decision log |

---

## Implementation Files

```
engines/complianceEngine.js      — ATP, reserved, quality stock, inspection lot, packing
engines/ruleEngine.js            — Phase 1 + 2 evaluation
engines/optimizationEngine.js    — Phase 3 + 4 selection
engines/executionPhases.js       — Phase constants
utils/complianceContext.js       — Load compliance data
services/allocationService.js    — Orchestration + GMP audit
services/complianceExplainService.js — Explain API
```

---

## Governance

- **Compliance failures are never overridden** by FIFO or optimization
- **Human approval** required for force allocation (`force: true`) — ADMIN only in production
- **SAP is system of record** — platform validates against ERP-aligned data
- **Validated state (MVP 5.0)** — IQ/OQ/PQ required before autonomous execution
