# SchedulingService — Entwurf (Roche Planner Agent MVP 2.0)

Ziel: Eine schlanke Planungs-Pipeline zwischen **Vue Cockpit**, **PlannerAgent** und einem **OR-Tools-Optimizer**, die bestehende Compliance-Engines wiederverwendet und den aktuellen JS-Sequencer (`lineSequencingEngine.optimize`) ersetzt.

## Problem heute

| Symptom | Ursache |
|---------|---------|
| Wizard / Planner-Dashboard sehr langsam | `getRecommendedSequence()` ruft bei jedem Load `lineOpt.optimize()` auf |
| Ab ~90 Rough-Orders hängt `optimize()` | Heuristischer JS-Sequencer skaliert nicht |
| Zusätzliche I/O-Latenz | Jeder Optimize schreibt in `sequenceScenarios.json` (~23 MB) |

## Zielarchitektur

```
Vue Cockpit (Gantt / Wizard)
        │  REST /api/v1/planning/*
        ▼
PlannerAgent (GPT: Briefing, Erklärung, Freigabe)
        │  liest SchedulingService-Ergebnis + Evidence
        ▼
SchedulingService.js                    ← neue Fassade
        │
        ├── ConstraintPipeline          ← ATP, TRIC, RMSL, QA (bestehende Engines)
        ├── PriorityScorer              ← Risiko + Priorität + Liefertermin
        ├── SchedulingOptimizer         ← Interface
        │       ├── HeuristicOptimizer  ← Übergang: LineSequencingEngine (dev only)
        │       └── OrtoolsOptimizer    ← Ziel: CP-SAT / Job-Shop Sidecar
        └── ScheduleCache               ← kein Re-Optimize bei Dashboard-Load
        ▼
IDataProvider (JSON → SAP OData)
```

## Planungslogik (9 Schritte)

| # | Schritt | Implementierung heute | SchedulingService |
|---|---------|----------------------|-------------------|
| 1 | Aufträge lesen | `IDataProvider.getOrders()` / `roughPlannedOrders.json` | `loadOrders()` |
| 2 | ATP prüfen | `InventoryEngine.checkAtp()` | `ConstraintPipeline.checkAtp()` |
| 3 | TRIC prüfen | `ComplianceEngine.checkTric()` | `ConstraintPipeline.checkTric()` |
| 4 | RMSL prüfen | `RmslForecastEngine.calculateTriplePoint()` | `ConstraintPipeline.checkRmsl()` |
| 5 | QA Bestand | `inspectionLots.json` (PENDING/IN_PROGRESS) | `ConstraintPipeline.checkQaLots()` |
| 6 | Priorität | `RiskEngine.assess()` + Order-Priority | `PriorityScorer.score()` |
| 7 | Reihenfolge optimieren | `LineSequencingEngine.optimize()` ❌ | `OrtoolsOptimizer.optimize()` ✅ |
| 8 | Gantt | Cockpit Swimlane Gantt | `toGanttTasks()` (bestehend) |
| 9 | GPT erklärt | `PlanningAgent` + `LlmAgentService` | `explainSchedule()` |

## SchedulingService — öffentliche API

```javascript
class SchedulingService {
  /** Vollständiger Lauf: Constraints → Priorität → Optimize → Gantt */
  optimizeSequence({ startAnchor, orderIds, horizonDays, persistScenario })

  /** Dashboard: gecachtes Ergebnis, kein Auto-Optimize unless stale */
  getRecommendedSequence({ startAnchor, forceRefresh })

  /** Nur Compliance-Vorprüfung (What-If / Agent Input) */
  evaluateConstraints({ packagingOrderIds })

  /** Evidence für GPT / Copilot */
  buildExplanationContext(scheduleResult)
}
```

### Cache-Regeln

- Key: `{ optimizer, startAnchor, roughOrderCount, rulesVersion }`
- TTL: `SCHEDULING_CACHE_TTL_MS` (Default 5 min)
- `forceRefresh: true` nur bei explizitem „Optimize“-Button oder Agent-Trigger
- **Planner-Dashboard** ruft `getRecommendedSequence({ forceRefresh: false })`

### Szenario-Persistenz

- `_appendScenario` nur wenn `persistScenario: true` (Simulate / Save / Agent-Run)
- Read-only Dashboard: **kein** Schreiben in `sequenceScenarios.json`

## OR-Tools Sidecar (Phase 1)

Empfohlener Ansatz: **Python-Microservice** ( stabilste OR-Tools-Integration ).

```
Node SchedulingService
    │  POST /optimize  (JSON)
    ▼
ortools-sidecar (FastAPI / Flask, Port 8010)
    │  CP-SAT Model
    ▼
Response: { sequence[], score, kpis, solverStatus }
```

### Request-Payload (vereinfacht)

```json
{
  "horizonStart": "2026-09-01",
  "horizonDays": 90,
  "lines": [{ "lineId": "PACK_LINE_01", "capacityUnitsPerDay": 8000, "performanceFactor": 1.0 }],
  "calendars": [...],
  "orders": [
    {
      "packagingOrderId": "PO-20001",
      "materialNumber": "MAT-1000",
      "quantity": 2000,
      "priority": "HIGH",
      "requestedDeliveryDate": "2026-09-09",
      "eligibleBatchIds": ["BAT-001"],
      "hardConstraints": { "atp": true, "tric": true, "rmsl": true, "qaReleased": true },
      "priorityScore": 85
    }
  ]
}
```

### CP-SAT Modell (Skizze)

**Entscheidungsvariablen**

- `start[o]` — Starttag des Auftrags o
- `line[o,l]` — Binär: Auftrag o auf Linie l
- `batch[o,b]` — Binär: Batch-Zuordnung (optional, wenn schon in ConstraintPipeline fixiert)

**Harte Constraints**

- Keine Überlappung auf derselben Linie (Intervalle)
- Wartungsfenster aus `lineCalendars`
- TRIC / RMSL / ATP: nur zugelassene `(order, batch)`-Paare aus ConstraintPipeline
- Japan-Sequence: aufsteigende `batchSequence` für JP-Orders auf derselben Linie

**Zielfunktion (gewichtet)**

```
minimize  w1 * late_orders
        + w2 * rmsl_violations
        + w3 * fifo_deviations
        + w4 * jp_sequence_breaks
        + w5 * total_makespan
        - w6 * priority_score * placement_bonus
```

## Integration mit PlannerAgent

```javascript
// agents/planningAgent.js — erweitert, nicht ersetzt
const schedule = await schedulingService.getRecommendedSequence({ startAnchor });
const constraints = await schedulingService.evaluateConstraints({ packagingOrderIds: openIds });

return planningAgent.buildDailySummary({
  ...context,
  recommendedSequence: schedule.sequence,
  constraintSummary: constraints.summary,
  solverMeta: schedule.meta,  // { engine: 'ortools', status: 'OPTIMAL', runtimeMs }
});
```

GPT erhält **keine** Optimierung — nur strukturierte Evidence:

- `constraintSummary.passed / failed`
- Top-10 Risiko-Aufträge
- Solver-Status + KPI-Delta vs. Baseline
- Verweis auf Graph-Kontext (`ALLOCATION_EXPLAIN`)

## Migration (inkrementell)

| Phase | Aufgabe | Risiko |
|-------|---------|--------|
| **A** | `SchedulingService` + `ConstraintPipeline` + Cache | Niedrig |
| **B** | Dashboard/Wizard auf `getRecommendedSequence({ forceRefresh: false })` | Niedrig |
| **C** | OR-Tools Sidecar + `OrtoolsOptimizer` | Mittel |
| **D** | `dailyPlanningService` delegiert an `SchedulingService` | Mittel |
| **E** | HeuristicOptimizer entfernen / nur Fallback | Niedrig |
| **F** | PostgreSQL + Neo4j (Roadmap Phase 2–3) | Später |

## Env-Variablen

```bash
SCHEDULING_OPTIMIZER=ortools          # heuristic | ortools
ORTOOLS_URL=http://127.0.0.1:8010
SCHEDULING_CACHE_TTL_MS=300000
SCHEDULING_PERSIST_SCENARIOS=false      # default off for dashboard
SCHEDULING_MAX_ORDERS=500
```

## Dateien (neu)

| Datei | Rolle |
|-------|-------|
| `services/schedulingService.js` | Fassade |
| `services/scheduling/constraintPipeline.js` | ATP / TRIC / RMSL / QA |
| `services/scheduling/priorityScorer.js` | Prioritäts-Score |
| `services/scheduling/heuristicOptimizer.js` | Übergang (LineSequencingEngine) |
| `services/scheduling/ortoolsOptimizer.js` | HTTP-Client zum Sidecar |
| `scripts/ortools/optimize.py` | Referenz-CP-SAT-Modell |
| `scripts/ortools/requirements.txt` | `ortools`, `fastapi`, `uvicorn` |

## Abgrenzung zu bestehenden Services

| Service | Bleibt zuständig für |
|---------|---------------------|
| `AllocationService` | Einzelauftrag Batch-Zuordnung (Simulate/Execute) |
| `LineOptimizationService` | Gantt Drag-Drop Simulate (bis Phase D) |
| `DailyPlanningService` | Planner-Dashboard-Orchestrierung (delegiert an SchedulingService) |
| `SchedulingService` | **Sequenz-Optimierung + Constraint-Vorprüfung + Cache** |

## Nächster Implementierungsschritt

1. Phase A + B umsetzen (Cache + kein Szenario-Append beim Dashboard)
2. Sidecar lokal starten: `uvicorn scripts.ortools.app:app --port 8010`
3. `SCHEDULING_OPTIMIZER=ortools` setzen und mit 200 Demo-Orders benchmarken

### Phase B — Quick start

```powershell
# Dev (starts OR-Tools + Backend + Cockpit)
.\scripts\start.ps1 dev

# Benchmark
$env:SCHEDULING_OPTIMIZER='ortools'
node scripts/benchmark-scheduling.js

# Docker (ortools + backend + cockpit)
docker compose up --build
```

Sidecar health: http://127.0.0.1:8010/health  
Scheduling status: GET `/api/v1/planning/scheduling-status`

