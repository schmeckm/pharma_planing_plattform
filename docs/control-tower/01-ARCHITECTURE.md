# Control Tower — Architecture

**Edition:** MVP 4.0 — Global Supply Chain Control Tower  
**Baseline:** MVP 1–3 (Allocation, Enterprise, AI Intelligence)

## Vision

Single pane of glass for Finished Goods, Bulk Inventory, Packaging Orders, Sales Orders, and Market Demand — with real-time visibility, predictive risk, and actionable recommendations.

## Reference Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTROL TOWER EXPERIENCE (Vue 3)                      │
│  Global Inventory │ Market Demand │ Allocation │ Risk │ Events │ Twin   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ REST /api/v4/control-tower  +  WebSocket
┌───────────────────────────────▼─────────────────────────────────────────┐
│                      CONTROL TOWER SERVICE                               │
│  Aggregates inventory, demand, allocation, risk, events, twin, recs   │
└───────┬─────────────────┬─────────────────┬─────────────────┬─────────┘
        ▼                 ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Intelligence │  │ Allocation   │  │ Recommendation│  │ Event Bus    │
│ Service (v3) │  │ Service (v1) │  │ Engine       │  │ Kafka/Mesh   │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │                 │
        └─────────────────┴─────────────────┴─────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DATA: JSON Provider → SAP OData (S/4) → SAP IBP (demand) → SAP BTP     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Bounded Contexts

| Context | Module | Service Method |
|---------|--------|----------------|
| Inventory | Global Inventory View | `getGlobalInventory()` |
| Demand | Market Demand View | `getMarketDemand()` |
| Allocation | Allocation Monitor | `getAllocationMonitor()` |
| Risk | Risk Control Center | `getRiskControlCenter()` |
| Executive | Executive Dashboard | `getExecutiveDashboard()` |
| Events | Event Monitoring | `getEvents()` |
| Twin | Digital Twin | `getDigitalTwin()` |
| Actions | Recommendation Engine | `getRecommendations()` |

## GMP Principles

- Control Tower is **decision support** — not system of record
- SAP remains authoritative for inventory and orders
- Recommendations require human approval before execution
- All events and decisions are auditable

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, PrimeVue, Chart.js, Pinia |
| API | Node.js Express `/api/v4/control-tower` |
| Real-time | WebSocket `/ws/control-tower` |
| Future ERP | SAP S/4HANA, IBP, BTP, Event Mesh |
