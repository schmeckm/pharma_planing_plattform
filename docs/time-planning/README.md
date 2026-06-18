# Time-Based Allocation Planning

**Edition:** MVP 5.0

## Modules

| # | Doc | Topic |
|---|-----|-------|
| 1 | [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) | Architecture |
| 2 | [02-DATABASE-MODEL.md](./02-DATABASE-MODEL.md) | Order attributes + calendars |
| 8 | [08-API-SPECIFICATIONS.md](./08-API-SPECIFICATIONS.md) | REST API |

## UI

**http://localhost:3001/planning**

Tabs: Timeline, Gantt, Capacity, RMSL Risk, Market Delivery, Digital Twin, What-If

## Quick Start

```bash
npm start
cd cockpit && npm run dev
```

```bash
curl http://localhost:8000/api/v5/planning/dashboard?lineId=PACK_LINE_01 -H "X-User-Role: PLANNER"
```
