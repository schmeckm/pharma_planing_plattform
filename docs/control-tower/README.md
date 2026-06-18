# MVP 4.0 — Global Supply Chain Control Tower

**Status:** Architecture + Alpha Scaffold  
**Baseline:** MVP 1–3

## Vision

Real-time visibility and decision platform for Finished Goods, Bulk Inventory, Packaging Orders, Sales Orders, and Market Demand.

## Document Index

| # | Document | Topic |
|---|----------|-------|
| 1 | [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) | Reference architecture |
| 2 | [02-DATABASE-DESIGN.md](./02-DATABASE-DESIGN.md) | Entity model & SAP mapping |
| 3 | [03-DASHBOARD-MOCKUPS.md](./03-DASHBOARD-MOCKUPS.md) | UI wireframes |
| 4 | [04-KPI-DEFINITIONS.md](./04-KPI-DEFINITIONS.md) | KPI formulas & targets |
| 5 | [05-EVENT-MODEL.md](./05-EVENT-MODEL.md) | Events & WebSocket |
| 6 | [06-DIGITAL-TWIN-DESIGN.md](./06-DIGITAL-TWIN-DESIGN.md) | Twin entities & projections |
| 7 | [07-RECOMMENDATION-ENGINE.md](./07-RECOMMENDATION-ENGINE.md) | Recommendation types |
| 8 | [08-API-SPECIFICATIONS.md](./08-API-SPECIFICATIONS.md) | REST + WS API |
| 9 | [09-VUE-COMPONENT-STRUCTURE.md](./09-VUE-COMPONENT-STRUCTURE.md) | Frontend structure |
| 10 | [10-EXECUTIVE-PRESENTATION.md](./10-EXECUTIVE-PRESENTATION.md) | Executive slides |

## Executable Scaffold

```
services/controlTowerService.js
engines/recommendationEngine.js
websocket/wsHub.js
routes/v4/
controllers/v4/
data/plants.json, markets.json, forecasts.json, bulkInventory.json, ...
cockpit/src/views/v4/ControlTowerView.vue
```

## Quick Start

```bash
npm start
cd cockpit && npm run dev
# Open http://localhost:3001/control-tower
```

## API

```bash
curl http://localhost:8000/api/v4/control-tower/dashboard?horizon=7 \
  -H "X-User-Role: PLANNER"
```

WebSocket: `ws://localhost:8000/ws/control-tower`
