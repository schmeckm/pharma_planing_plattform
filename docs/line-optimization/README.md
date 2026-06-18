# Line Optimization Module

Plant-level Gantt sequencing for rough planned packaging orders from Global Planning.

## UI

**http://localhost:3001/line-optimization**

Features:
- Swimlane Gantt (drag-and-drop, move between lines)
- KPI cards (rough orders, risk, RMSL, JP sequence, utilization)
- Order detail panel with triple-point RMSL
- Auto optimize + simulate + save
- Before/after comparison panel

## API (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/line-optimization/orders` | Orders + Gantt tasks + KPIs |
| GET | `/api/v1/line-optimization/lines` | Production lines + calendars |
| POST | `/api/v1/line-optimization/simulate` | Re-simulate after manual changes |
| POST | `/api/v1/line-optimization/optimize` | Auto-optimize sequence |
| POST | `/api/v1/line-optimization/save-sequence` | Save to `optimizedSchedule.json` |

## Engines

| Engine | File |
|--------|------|
| Line Sequencing | `engines/lineSequencingEngine.js` |
| Capacity | `engines/capacityEngine.js` |
| Schedule Impact | `engines/scheduleImpactEngine.js` |
| RMSL Forecast | `engines/rmslForecastEngine.js` |
| Sequence Validation | `engines/sequenceValidationEngine.js` |

## Optimization Logic

1. Load rough planned orders
2. Sort by priority + requested delivery date
3. Check line availability (capacity + maintenance)
4. Validate TRIC, triple-point RMSL, FIFO
5. Validate Japan continuous batch sequence
6. Minimize late orders, RMSL violations, FIFO deviations, idle time
7. Return optimized Gantt sequence

## Data Files

- `data/roughPlannedOrders.json` — from Global Planning
- `data/optimizedSchedule.json` — saved plant sequence
- `data/sequenceScenarios.json` — simulation history
- `data/productionLines.json` — line master
- `data/lineCalendars.json` — shifts + maintenance

## Quick Start

```bash
# Backend
npm start

# Frontend
cd cockpit && npm run dev
```

```bash
curl http://localhost:8000/api/v1/line-optimization/orders
curl -X POST http://localhost:8000/api/v1/line-optimization/optimize -H "Content-Type: application/json" -d "{}"
```

Swagger: http://localhost:8000/docs

## Gantt Library

**frappe-gantt** is installed for future timeline views. The MVP uses **SwimlaneGantt.vue** (custom Vue component) for multi-line drag-and-drop — required for moving orders between packaging lines.
