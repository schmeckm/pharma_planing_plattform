# Daily Production Sequencing Cockpit

Planner-friendly workflow for converting Global Planning rough planned Packaging Orders into a detailed sequence per packaging line.

## Business Process

1. **Global Planning** sends rough planned orders (`roughPlannedOrders.json`)
2. **Plant planner** opens Daily Planning Dashboard to review orders for a date
3. **Production Sequencing** builds recommended sequence, drag-drops on Gantt, runs what-if
4. **Confirm sequence** persists to `optimizedSchedule.json`
5. **Batch Recommendations** simulates hard allocation per sequenced order
6. **Planning Exceptions** surface sequencing and allocation issues

## Time-Aware Order Attributes

| Field | Description |
|-------|-------------|
| `plannedStartDate` | Detailed plan start |
| `plannedEndDate` | Detailed plan end |
| `actualStartDate` | Shop floor actual (nullable) |
| `actualEndDate` | Shop floor actual (nullable) |
| `requestedDeliveryDate` | Customer delivery date |
| `productionLine` | Packaging line resource |
| `durationHours` | Processing duration |
| `priority` | HIGH / MEDIUM / LOW |

## Planner Terminology

| Engine term | Planner label |
|-------------|---------------|
| TRIC Validation | Market Release Check |
| RMSL | Shelf-Life Risk |
| Allocation Simulation | What-if Simulation |
| Optimization Engine | Recommended Sequence |
| Blocked Orders | Planning Exceptions |
| Hard Allocation | Confirmed Batch Assignment |

## API Endpoints (`/api/v1/planning`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/daily-orders` | Rough + scheduled orders with Gantt data |
| GET | `/recommended-sequence` | Auto-optimized sequence |
| POST | `/what-if` | Simulate custom sequence after drag-drop |
| POST | `/confirm-sequence` | Confirm and persist plant sequence |
| POST | `/simulate-batch-assignment` | Batch recommendations for sequenced orders |
| GET | `/exceptions` | Sequencing + allocation exceptions |
| GET | `/confirmed-schedule` | Last confirmed plant sequence |

## Vue Cockpit Pages

| Route | Page |
|-------|------|
| `/daily-planning` | Daily Planning Dashboard |
| `/line-optimization` | Production Sequencing (Gantt drag-drop) |
| `/what-if` | Sequence + allocation what-if |
| `/exceptions` | Planning Exceptions |
| `/simulation` | Batch Recommendations |
| `/confirmed-assignments` | Confirmed sequences + batch assignments |

## JSON Data Files

| File | Content |
|------|---------|
| `productionLines.json` | Packaging line resources |
| `lineCalendars.json` | Shift calendars and maintenance |
| `roughPlannedOrders.json` | Global planning rough plan |
| `optimizedSchedule.json` | Confirmed plant sequence |
| `sequenceScenarios.json` | What-if and optimize history |

## Quick Start

```bash
npm start
cd cockpit && npm run dev
```

Open http://localhost:3001/daily-planning → Production Sequencing → drag orders → Confirm Sequence.
