# Project Structure

```
Hard Allocation Engine/
├── server.js                    # Express entry, mounts v1–v5 APIs
├── package.json
├── Dockerfile
├── docker-compose.yml
├── docker-compose.mvp2.yml
│
├── routes/
│   ├── index.js                 # /api/v1 — allocation, planning, performance
│   └── v2/                      # Enterprise APIs
│
├── controllers/
│   ├── allocation.controller.js
│   ├── planning.controller.js
│   ├── performance.controller.js
│   └── lineOptimization.controller.js
│
├── services/
│   ├── allocationService.js
│   ├── dailyPlanningService.js
│   ├── lineOptimizationService.js
│   ├── performanceService.js
│   ├── ruleManagementService.js
│   ├── exceptionService.js
│   ├── auditService.js
│   └── authService.js
│
├── engines/
│   ├── allocationEngine.js          # Hard allocation orchestration
│   ├── ruleEngine.js                # 7-tier rule evaluation
│   ├── complianceEngine.js          # P1 compliance gates
│   ├── fifoEngine.js                # P4 FIFO
│   ├── optimizationEngine.js        # Batch selection rationale
│   ├── riskEngine.js                # LOW/MEDIUM/HIGH scoring
│   ├── historicalPerformanceEngine.js  # Line score, OEE, throughput
│   ├── lineSequencingEngine.js      # Gantt optimize + simulate
│   ├── scheduleImpactEngine.js      # What-if impact analysis
│   ├── sequenceValidationEngine.js
│   ├── capacityEngine.js
│   ├── whatIfEngine.js
│   ├── exceptionEngine.js
│   ├── copilotEngine.js
│   └── executionPhases.js           # Hierarchy constants
│
├── providers/
│   ├── IDataProvider.js
│   ├── JsonProvider.js
│   ├── SAPODataProvider.js
│   └── index.js
│
├── data/                            # JSON prototype store
│   ├── orders.json, batches.json, rules.json
│   ├── roughPlannedOrders.json
│   ├── productionLines.json, lineCalendars.json
│   ├── historicalPerformance.json
│   ├── optimizedSchedule.json, sequenceScenarios.json
│   ├── exceptions.json, auditTrail.json
│   └── rulesV2.json, users.json
│
├── swagger/openapi.yaml
│
├── cockpit/                         # Vue 3 Planner Cockpit
│   └── src/
│       ├── views/
│       │   ├── DailyPlanningDashboardView.vue
│       │   ├── LineOptimizationView.vue
│       │   ├── SimulationView.vue
│       │   ├── ConfirmedBatchAssignmentsView.vue
│       │   ├── AuditTrailView.vue
│       │   └── v2/ (RuleManagement, WhatIf, Exceptions, ...)
│       ├── components/lineOptimization/SwimlaneGantt.vue
│       ├── stores/dailyPlanning.js
│       └── api/planning.js, v2.js
│
└── docs/
    ├── enterprise/                  # This documentation set
    ├── daily-planning/
    ├── mvp2/
    └── compliance/
```
