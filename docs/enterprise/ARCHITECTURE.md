# Enterprise Architecture — Pharmaceutical Allocation & Production Sequencing Platform

## System Context

```mermaid
flowchart TB
  subgraph global [Global Planning]
    RP[Rough Planned Orders]
  end

  subgraph plant [Plant Planner Cockpit — Vue 3]
    DP[Daily Planning Dashboard]
    PS[Production Sequencing Gantt]
    WI[What-if Simulation]
    EX[Planning Exceptions]
    BR[Batch Recommendations]
    CA[Confirmed Assignments]
    AT[Audit Trail]
    RM[Rule Management]
  end

  subgraph api [Node.js Express API]
    V1[/api/v1 Core + Planning/]
    V2[/api/v2 Enterprise/]
  end

  subgraph engines [Business Engines]
    SEQ[Line Sequencing Engine]
    HPE[Historical Performance Engine]
    ALLOC[Allocation Engine]
    RISK[Risk Engine]
    WHATIF[What-if / Schedule Impact]
    RULE[Rule Engine]
  end

  subgraph data [Data Abstraction]
    IDP[IDataProvider]
    JSON[JsonProvider]
    SAP[SAPODataProvider Mock]
  end

  subgraph future [Future SAP S/4HANA]
    ODATA[SAP OData APIs]
    BTP[SAP BTP]
    EM[Event Mesh]
  end

  RP --> DP
  DP --> PS --> WI
  PS --> BR --> CA
  plant --> api --> engines --> IDP
  IDP --> JSON
  IDP -.-> SAP -.-> future
```

## Allocation Decision Hierarchy

| Priority | Tier | Rules | Engine |
|----------|------|-------|--------|
| 1 | Compliance | Market Release, Quality, RMSL, Batch Split, Country/Customer rules | `complianceEngine`, `ruleEngine` |
| 2 | Availability | ATP, Reserved, Safety Stock, Quality Stock, Inspection Lot | `inventoryEngine`, `complianceEngine` |
| 3 | Market Rules | Japan Sequence, Customer/Market Priority | `sequencingEngine`, `sequenceValidationEngine` |
| 4 | Inventory Optimization | FEFO, FIFO | `fifoEngine`, `optimizationEngine` |
| 5 | Production Performance | OEE, Throughput, Reliability, Yield, Setup, Downtime | `historicalPerformanceEngine` |
| 6 | Production Optimization | Campaign, Changeover, Utilization, Capacity | `capacityEngine`, `lineSequencingEngine` |
| 7 | Enterprise Optimization | Inventory Risk, Service Level, Market Coverage | `globalOptimizationEngine`, `riskEngine` |

**GMP principle:** Compliance gates are hard stops. Optimization never overrides regulatory failure.

## Sequencing Flow

1. Load rough planned orders from Global Planning
2. Score production lines per material (Historical Performance Engine)
3. Place orders on highest-scoring feasible line
4. Validate TRIC, RMSL, Japan sequence per slot
5. Generate Gantt tasks with expected OEE, throughput, yield
6. What-if re-simulates on drag-drop
7. Confirm sequence → optimized schedule → batch assignment

## Line Score Formula

```
Line Score = 30% OEE + 25% Throughput + 20% Reliability + 15% Yield + 10% Setup Time (inverted)
```

## Risk Engine

Levels: **LOW** | **MEDIUM** | **HIGH**

Factors: eligible batches, RMSL margin, ATP coverage, delivery urgency, market restrictions, batch split restriction, **line reliability**.

## Audit Trail (GMP)

Every allocation decision records: order, sales order, batch, country, rules executed, decision, user, timestamp, **engine version**, rule set version, risk score, packing system reference.

## SAP Integration Layer

All services consume data through `IDataProvider`. Swap `JsonProvider` → `SAPODataProvider` via `HAP_DATA_PROVIDER=sap` without changing business logic.
