# Implementation Roadmap

## Phase 1 — Foundation (Complete)

- [x] Node.js 20 + Express API with Swagger
- [x] JSON data store with JsonRepository
- [x] Core allocation engine (compliance-first)
- [x] Vue 3 cockpit with PrimeVue + Element Plus
- [x] Docker deployment
- [x] IDataProvider abstraction

## Phase 2 — Enterprise Governance (Complete)

- [x] Versioned rule management (7 categories)
- [x] Exception queue with workflow
- [x] Role-based access (Planner, QA, Supply Chain, Admin, Viewer)
- [x] Mass allocation jobs
- [x] Allocation copilot (internal reasoning)
- [x] GMP audit trail with engine version

## Phase 3 — Production Sequencing (Complete)

- [x] Daily Planning Dashboard
- [x] Swimlane Gantt with drag-drop
- [x] Recommended sequence optimization
- [x] What-if simulation (sequence + allocation)
- [x] Confirm sequence workflow
- [x] Batch assignment simulation per sequence

## Phase 4 — Historical Performance (Complete)

- [x] Historical Performance Repository (`historicalPerformance.json`)
- [x] Weighted Line Score (30/25/20/15/10)
- [x] Line recommendation by highest score
- [x] Expected OEE, throughput, yield on sequenced orders
- [x] Line reliability in risk engine
- [x] OEE/capacity/compliance impact in what-if

## Phase 5 — SAP Integration (Next)

- [ ] Connect SAPODataProvider to real OData entity sets
- [ ] Packaging Orders from `A_PackagingOrder`
- [ ] Batch stock from `A_BatchStock`
- [ ] ATP from SAP MM/PP
- [ ] SAP Event Mesh for allocation events
- [ ] SAP BTP side-by-side extension deployment

## Phase 6 — Advanced Optimization (Future)

- [ ] FEFO inventory strategy
- [ ] Customer/market priority rules in allocation
- [ ] Campaign planning and changeover optimization
- [ ] Global inventory balancing across plants
- [ ] ML-based demand forecasting integration
- [ ] Real-time OEE from SAP MII

## Phase 7 — Production Hardening (Future)

- [ ] PostgreSQL persistence
- [ ] JWT/OAuth authentication
- [ ] Horizontal scaling with job queue (Redis/Bull)
- [ ] Observability (OpenTelemetry)
- [ ] Automated GMP validation test suite
