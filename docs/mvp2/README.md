# MVP 2.0 Enterprise Edition

Production Sequencing & Allocation Optimizer — governed rules, Gantt sequencing, line performance scoring, risk engine, what-if simulation, planning exceptions, RBAC, SAP integration prep, and allocation copilot.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

## Features

| Capability | Description |
|------------|-------------|
| **Rule Management** | Country, Customer, Product, Market, Sequence, RMSL, Batch Split rules — versioned, effective-dated, auditable, exportable |
| **Exception Queue** | Market release, shelf-life, inventory, batch split, Japan sequence, missing SO link, missing packing system |
| **Risk Engine** | LOW / MEDIUM / HIGH from eligible batches, RMSL margin, ATP coverage, urgency, market & split restrictions |
| **Mass Allocation** | Daily and weekly background jobs with progress tracking and result history |
| **RBAC** | Planner, QA, Supply Chain, Admin, Viewer roles via `X-User-Id` / `X-User-Role` headers |
| **SAP Prep** | `IDataProvider`, `JsonProvider`, `SAPODataProvider` mock — no live SAP connection |
| **Allocation Copilot** | Internal rule-based explanations (no OpenAI) |

## Quick Start

```bash
# Local
npm install && npm start

# Docker (MVP 2.0 overlay)
docker compose -f docker-compose.yml -f docker-compose.mvp2.yml up --build
```

| Service | URL |
|---------|-----|
| API v2 | http://localhost:8001/api/v2 |
| Swagger | http://localhost:8001/docs |
| Vue Cockpit | http://localhost:3001 |

## Demo Users

| Username | Role | Permissions highlight |
|----------|------|----------------------|
| `planner` | PLANNER | Simulate, execute, jobs, copilot |
| `qa` | QA | Resolve exceptions, audit |
| `supplychain` | SUPPLY_CHAIN | Escalate, what-if |
| `admin` | ADMIN | Rule write, user management |
| `viewer` | VIEWER | Read-only |

## API Examples

```bash
# Login (sets user profile)
curl -X POST http://localhost:8000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"planner"}'

# List rules
curl http://localhost:8000/api/v2/rules \
  -H "X-User-Id: USR-PLANNER01" -H "X-User-Role: PLANNER"

# Start daily mass allocation
curl -X POST http://localhost:8000/api/v2/jobs/mass-allocation \
  -H "Content-Type: application/json" \
  -H "X-User-Id: USR-PLANNER01" -H "X-User-Role: PLANNER" \
  -d '{"period":"DAILY","execute":false}'

# Copilot
curl -X POST http://localhost:8000/api/v2/copilot/ask \
  -H "Content-Type: application/json" \
  -H "X-User-Id: USR-PLANNER01" -H "X-User-Role: PLANNER" \
  -d '{"question":"Which batch is recommended?","packagingOrderId":"PO-20001"}'

# Data provider info
curl http://localhost:8000/api/v2/provider \
  -H "X-User-Id: USR-PLANNER01" -H "X-User-Role: PLANNER"
```

## SAP Integration Path

Set `HAP_DATA_PROVIDER=sap` to use `SAPODataProvider` mock:

```bash
HAP_DATA_PROVIDER=sap npm start
```

Replace mock OData methods in `providers/SAPODataProvider.js` with real HTTP calls when SAP is available.

## Architecture

```
rulesV2.json (governed) ──► utils/rulesAdapter.js ──► runtime rules ──► RuleEngine / AllocationEngine
                                    ▲
Rule Management UI ──► /api/v2/rules ──► RuleManagementService ──► JsonProvider
```

Enterprise rule edits in the cockpit flow through `rulesV2.json`. At allocation time, `DataService.getRules()` merges effective-dated v2 rules with base `rules.json` compliance definitions via `buildRuntimeRules()`.

## Data Files

| File | Purpose |
|------|---------|
| `data/rulesV2.json` | Versioned enterprise rules |
| `data/exceptions.json` | Exception queue (7 demo types) |
| `data/jobs.json` | Mass allocation job history |
| `data/users.json` | RBAC demo users |
