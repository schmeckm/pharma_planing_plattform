# Hard Allocation Platform — Architecture (MVP 2.0 Enterprise)

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vue 3 Cockpit (Port 3001)                     │
│  Dashboard │ Simulation │ What-If │ Exceptions │ Copilot │ Jobs │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API v1 + v2
┌────────────────────────────▼────────────────────────────────────┐
│                   Node.js Express (Port 8000)                    │
│  Controllers → Services → Engines → IDataProvider                │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     JsonProvider (MVP)          SAPODataProvider (Mock)
              │                             │
              ▼                             ▼
         data/*.json              SAP OData / RFC (Future)
```

## Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| Controllers | HTTP, auth headers, no business logic |
| Services | Orchestration, transactions, audit |
| Engines | Pure rule/risk/copilot/what-if logic |
| Providers | Data access abstraction (IDataProvider) |
| Middleware | RBAC, error handling |

## Engine Design

### Rule Engine (v1 + Rule Management v2)
- v1: `engines/ruleEngine.js` — runtime evaluation from `data/rules.json`
- v2: `services/ruleManagementService.js` — versioned rules in `data/rulesV2.json`
- Categories: COUNTRY, CUSTOMER, PRODUCT, MARKET, SEQUENCE, RMSL, BATCH_SPLIT
- Effective dating: `effectiveFrom` / `effectiveTo`
- Audit: append-only log in rulesV2.json

### Risk Engine
- `engines/riskEngine.js`
- Factors: eligible batches, RMSL margin, inventory coverage, market restrictions, delivery urgency
- Output: score 0–100, level LOW | MEDIUM | HIGH
- Attached to every allocation result

### Exception Engine
- `engines/exceptionEngine.js`
- Maps rule failures → exception types
- Integrated with Exception Queue service

### What-If Engine
- `engines/whatIfEngine.js`
- Applies scenario overrides to rules
- Compares baseline vs scenario (impact + risk analysis)

### Copilot Engine
- `engines/copilotEngine.js`
- Internal reasoning — no external AI
- Pattern-matches questions → explains from rule checks and audit data

## IDataProvider

```javascript
// Switch provider via environment
HAP_DATA_PROVIDER=json   // default
HAP_DATA_PROVIDER=sap     // mock OData
```

## Security Model

Roles: PLANNER, QA, SUPPLY_CHAIN, ADMIN, VIEWER

Headers (dev):
- `X-User-Id`
- `X-User-Role`
- `X-User-Name`

## Mass Allocation Jobs

- Async in-process worker (batch size 5)
- Status: QUEUED → RUNNING → COMPLETED
- Progress tracking via `data/jobs.json`
- Failed allocations auto-create exceptions

## API Versions

| Version | Prefix | Scope |
|---------|--------|-------|
| v1 | `/api/v1` | MVP 1.0 allocation, orders, batches |
| v2 | `/api/v2` | Enterprise: rules, exceptions, jobs, copilot, what-if, auth |
