# Pharmaceutical Allocation & Production Sequencing Platform

> **Enterprise Architecture** — [docs/enterprise/ARCHITECTURE.md](docs/enterprise/ARCHITECTURE.md) | [Project Structure](docs/enterprise/PROJECT-STRUCTURE.md) | [Roadmap](docs/enterprise/IMPLEMENTATION-ROADMAP.md).  
> **Daily Production Sequencing Cockpit** — [docs/daily-planning/README.md](docs/daily-planning/README.md).  
> **MVP 2.0 Enterprise Edition** — [docs/mvp2/README.md](docs/mvp2/README.md) *(current release)*.  
> **MVP 5.0 Time-Based Allocation Planning** — [docs/time-planning/README.md](docs/time-planning/README.md).  
> **Pharmaceutical GMP Compliance** — [docs/compliance/PHARMACEUTICAL-COMPLIANCE.md](docs/compliance/PHARMACEUTICAL-COMPLIANCE.md).  
> **MVP 4.0 Global Supply Chain Control Tower** — [docs/control-tower/README.md](docs/control-tower/README.md).  
> **MVP 3.0 AI-Assisted Global Allocation** — [docs/mvp3/README.md](docs/mvp3/README.md).

| Component | Port | Path |
|-----------|------|------|
| Node.js API v1 + v2 | 8000 / 8001 (Docker) | `/api/v1`, `/api/v2` |
| Vue 3 Cockpit | 3001 | `cockpit/` |

---

# Enterprise Platform Overview

End-to-end pharmaceutical **hard allocation** and **production sequencing** for plant planners.

| Capability | Description |
|------------|-------------|
| **7-Tier Allocation Hierarchy** | Compliance → Availability → Market → Inventory → Performance → Optimization → Enterprise |
| **Historical Performance Engine** | Line Score (30% OEE, 25% throughput, 20% reliability, 15% yield, 10% setup) |
| **Production Sequencing** | Gantt drag-drop, recommended sequence, what-if, confirm |
| **Risk Engine** | LOW / MEDIUM / HIGH with line reliability |
| **GMP Audit Trail** | Immutable decisions with engine version |
| **SAP Ready** | IDataProvider → JsonProvider / SAPODataProvider |

### Planner Cockpit Pages

Daily Planning · Production Sequencing · What-if · Planning Exceptions · Batch Recommendations · Confirmed Assignments · Audit Trail · Rule Management · Administration

### Quick Start

```bash
npm install && npm start
cd cockpit && npm install && npm run dev
docker compose up --build
```

| Service | URL |
|---------|-----|
| API | http://localhost:8000/api/v1 |
| Performance API | http://localhost:8000/api/v1/performance/line-scores |
| Swagger | http://localhost:8000/docs |
| Cockpit | http://localhost:3001 |

---

# Hard Allocation Platform — MVP 2.0 Enterprise Edition

Pharmaceutical allocation platform with enterprise governance: **versioned rules**, **exception workflow**, **risk engine**, **mass allocation jobs**, **role-based access**, **SAP provider abstraction**, and **allocation copilot**.

## MVP 2.0 Capabilities

1. **Rule Management** — Edit Country, Customer, Product, Market, Sequence, RMSL, and Batch Split rules from the cockpit. Rules are versioned, effective-dated, auditable, and exportable.
2. **Exception Management** — Queue for market release, shelf-life, inventory, batch split, Japan sequence, missing SO link, and missing packing system. Review, comment, escalate, resolve.
3. **Risk Engine** — LOW / MEDIUM / HIGH scoring from eligible batches, RMSL margin, ATP coverage, delivery urgency, market restriction, batch split restriction.
4. **Mass Allocation** — Daily and weekly background jobs with progress tracking and per-order result history.
5. **Role-based Access** — Planner, QA, Supply Chain, Admin, Viewer (header-based RBAC for MVP).
6. **SAP Integration Prep** — `IDataProvider` → `JsonProvider` (default) or `SAPODataProvider` mock (`HAP_DATA_PROVIDER=sap`).
7. **Allocation Copilot** — Explains batch selection, blocked orders, order moves, and recommendations using internal rule results only.

## MVP 2.0 Quick Start

```bash
npm install && npm start
# API: http://localhost:8000/api/v2
# Swagger: http://localhost:8000/docs
# Cockpit: cd cockpit && npm install && npm run dev  → http://localhost:3001
```

```bash
# Docker with MVP 2.0 overlay
docker compose -f docker-compose.yml -f docker-compose.mvp2.yml up --build
```

Demo users: `planner`, `qa`, `supplychain`, `admin`, `viewer` — switch role in the cockpit header.

```bash
npm test             # Smoke (32) + E2E HTTP (31) — full MVP 2.0 verification
npm run test:smoke   # Backend engines only
npm run test:e2e     # Live API against running server
```

See [docs/mvp2/README.md](docs/mvp2/README.md) for full API reference and architecture.

---

---

# Hard Allocation Platform — MVP 1.0 (Node.js)

Pharmaceutical **Hard Allocation Platform** for allocating Finished Goods batches to Packaging Orders. Packaging Orders are Make-to-Stock but linked via the **Packing** planning system to Sales Orders, which determine destination country and market-specific rules.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js 20 + Express.js |
| Data | JSON files (MVP) |
| API Docs | Swagger / OpenAPI 3.0 |
| Frontend | React (SAP Fiori-style) |
| Future | SAP OData / RFC integration |

## Architecture

```
server.js
├── routes/           → HTTP routing
├── controllers/      → Request/response handling (no business logic)
├── services/         → Application orchestration
├── engines/          → Configurable rule engines
│   ├── complianceEngine.js
│   ├── fifoEngine.js
│   ├── sequencingEngine.js
│   ├── optimizationEngine.js
│   └── ruleEngine.js
├── data/             → JSON prototype store
├── swagger/          → OpenAPI specification
└── utils/            → Repository, errors, dates
```

**Design principles:**
- Controllers are thin — no hardcoded business rules
- All rules configurable via `data/rules.json`
- `JsonRepository` swappable for SAP OData/RFC adapters

## Business Rules

1. **TRIC** — batch must be approved for destination country
2. **RMSL** — remaining shelf life meets country threshold
3. **Quality** — only `RELEASED` batches
4. **Batch Split** — full quantity from one batch where required
5. **FIFO** — oldest compliant batch first
6. **Japan Sequence** — continuous output sequence (B01 → B02 → B03)
7. **Audit Trail** — every decision logged with rule-level detail

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
# Install dependencies
npm install

# Start API server
npm start

# Dev mode with auto-reload
npm run dev
```

### Cockpit (UI)

```powershell
.\scripts\start.ps1 dev
```

| Service | URL |
|---------|-----|
| **Cockpit** | http://localhost:3001/wizard |
| API | http://localhost:8000/api/v1 |
| Swagger UI | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

Alternativ nur Cockpit manuell:

```bash
cd cockpit
npm install
npm run dev
```

### Docker

```bash
docker-compose up --build
```

- Backend: http://localhost:8000
- Cockpit: http://localhost:3001

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/orders` | List packaging orders |
| GET | `/api/v1/batches` | List finished goods batches |
| POST | `/api/v1/allocation/simulate` | Simulate allocation |
| POST | `/api/v1/allocation/execute` | Execute allocation |
| POST | `/api/v1/allocation/mass-simulate` | Bulk simulation |
| GET | `/api/v1/audit-trail` | Audit trail |
| GET | `/api/v1/rules` | Get rules configuration |
| PUT | `/api/v1/rules` | Update country rules |
| GET | `/api/v1/dashboard` | Dashboard KPIs |

### Example: Simulate Allocation

```bash
curl -X POST http://localhost:8000/api/v1/allocation/simulate \
  -H "Content-Type: application/json" \
  -d '{"packagingOrderId":"PO-20001","userId":"API-USER"}'
```

## Data Files

| File | Content |
|------|---------|
| `data/orders.json` | Sales orders + packaging orders |
| `data/batches.json` | Finished goods batches |
| `data/rules.json` | Country rules, rule definitions, sequence state |
| `data/auditTrail.json` | Allocation audit log |

## Demo Scenarios

| Order | Country | Expected Batch | Rule Highlight |
|-------|---------|----------------|----------------|
| PO-20001 | DE | BATCH-DE-001 | FIFO skips blocked batch |
| PO-20002 | GB | BATCH-GB-001 | No batch split |
| PO-20003 | JP | BATCH-JP-001 | Sequence B01 |
| PO-20004 | JP | BATCH-JP-002 | After PO-20003 executed |
| PO-20006 | CH | BATCH-CH-001 | Skips low-RMSL batch |

## SAP Integration Path

Replace `utils/jsonRepository.js` with SAP adapters:

- **OData** — read packaging orders, batches, country rules
- **RFC/BAPI** — post allocation confirmations, update inventory
- **CDS Views** — TRIC approvals, RMSL requirements

Engine and service layers remain unchanged.

## Project Structure

```
.
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── routes/
├── controllers/
├── services/
├── engines/
├── data/
├── swagger/
├── utils/
├── cockpit/           # Vue 3 Enterprise Cockpit (Haupt-UI)
```

## License

Proprietary — Internal MVP
