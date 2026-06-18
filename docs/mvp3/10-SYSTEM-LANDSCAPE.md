# MVP 3.0 — Complete System Landscape

## 1. System Context Diagram (C4 Level 1)

```mermaid
C4Context
    title System Context — Hard Allocation Optimization Platform MVP 3.0

    Person(planner, "Allocation Planner", "Simulates and executes batch allocation")
    Person(qa, "QA Specialist", "Reviews quality releases and exceptions")
    Person(executive, "Supply Chain Executive", "Monitors global risk KPIs")
    Person(admin, "Platform Admin", "Manages rules and agents")

    System(hap, "Hard Allocation Platform", "AI-assisted global allocation decisions")
    System_Ext(sap, "SAP S/4HANA", "ERP — orders, batches, inventory, QM, GTS")
    System_Ext(packing, "Packing System", "Packaging order planning")
    System_Ext(neo4j, "Neo4j", "Knowledge Graph")
    System_Ext(kafka, "Kafka / Event Mesh", "Event streaming")
    System_Ext(llm, "Azure OpenAI", "Optional LLM — governed")

    Rel(planner, hap, "Uses cockpit, approves allocations")
    Rel(qa, hap, "Reviews QA agent recommendations")
    Rel(executive, hap, "Views executive dashboard")
    Rel(admin, hap, "Configures rules and agents")
    Rel(hap, sap, "OData read / BAPI write", "HTTPS")
    Rel(hap, packing, "Packaging orders", "OData/API")
    Rel(hap, neo4j, "Graph queries", "Bolt")
    Rel(hap, kafka, "Publish/consume events")
    Rel(sap, kafka, "Business events")
    Rel(hap, llm, "Optional Copilot", "HTTPS/VNet")
```

## 2. Container Diagram (C4 Level 2)

```mermaid
flowchart TB
    subgraph Experience["Experience Layer"]
        PC[Planner Cockpit<br/>Vue 3 + PrimeVue]
        EC[Executive Cockpit<br/>Vue 3 + D3]
        CP[AI Copilot UI]
        AC[Agent Console]
    end

    subgraph Gateway["API Gateway"]
        APIGW[Express API Gateway<br/>v1 / v2 / v3]
        WS[WebSocket Server]
    end

    subgraph Application["Application Services"]
        AS[Allocation Service]
        TS[Digital Twin Service]
        PS[Predictive Risk Service]
        OS[Agent Orchestrator]
        ES[Exception Service]
        RS[Rule Management]
        GS[Graph Sync Service]
    end

    subgraph Intelligence["AI & Analytics"]
        PA[Planning Agent]
        QA[QA Agent]
        SC[Supply Chain Agent]
        CA[Compliance Agent]
        CO[Copilot Engine]
        GO[Global Optimizer]
    end

    subgraph Data["Data & Integration"]
        JP[JsonProvider]
        SP[SAP OData Provider]
        GR[Graph Repository]
        EB[Event Bus]
    end

    subgraph External["External Systems"]
        SAP[SAP S/4HANA]
        N4J[(Neo4j)]
        KFK[Kafka / Event Mesh]
    end

    PC & EC & CP & AC --> APIGW
    APIGW --> AS & TS & PS & OS & ES & RS
    OS --> PA & QA & SC & CA
    CP --> CO
    AS --> GO
    TS & PS --> AS
    PA & QA & SC & CA --> CO
    AS & RS --> JP & SP
    GS --> GR & SP
    GR --> N4J
    EB --> KFK
    SP --> SAP
    KFK --> SAP
    GS --> EB
    OS --> EB
```

## 3. Deployment Landscape

```mermaid
flowchart LR
    subgraph Corporate["Corporate Network / BTP"]
        subgraph K8s["Kubernetes Cluster"]
            API[API Pods x3]
            AGT[Agent Worker Pods x2]
            TWIN[Twin Engine Pod]
        end
        COCKPIT[Vue SPA<br/>CDN / Nginx]
        NEO[(Neo4j Cluster)]
        KAFKA[Kafka Cluster]
        REDIS[(Redis Cache)]
    end

    subgraph SAP_Landscape["SAP Landscape"]
        S4[S/4HANA]
        GTS[SAP GTS]
        EM[SAP Event Mesh]
        PACK[Packing System]
    end

    subgraph Cloud["Azure (Optional)"]
        OAI[Azure OpenAI<br/>Private Endpoint]
    end

    COCKPIT --> API
    API --> NEO & KAFKA & REDIS
    AGT --> KAFKA
    API --> S4 & GTS & PACK
    S4 --> EM --> KAFKA
    API -.-> OAI
```

## 4. Data Flow — Allocation Decision

```
1. SAP Event: packaging_order.released
2. Event Bus → Twin Sync + Graph Sync
3. Planning Agent (scheduled): scan T+7 projections
4. Risk detected → What-If simulations
5. Recommendation → Exception Queue + Agent Console
6. Planner reviews in Copilot ("Why blocked?")
7. Planner approves → Execute allocation
8. SAP BAPI confirm → Event → Graph update
9. Executive Dashboard KPI refresh
```

## 5. Technology Inventory

| Component | MVP 1 | MVP 2 | MVP 3 | MVP 5 |
|-----------|-------|-------|-------|-------|
| Backend | Node.js | + v2 API | + v3, agents | Validated |
| Frontend | React/Vue | Vue Cockpit | + Executive | Fiori embed |
| Data | JSON | + Provider | + Graph, Twin | HANA |
| AI | — | Rule Copilot | Multi-agent | Governed LLM |
| Events | — | — | Kafka shadow | Production |
| SAP | — | Mock | OData read | Full integration |

## 6. Network & Security Zones

| Zone | Components | Access |
|------|------------|--------|
| DMZ | Cockpit CDN, API Gateway | HTTPS public (auth) |
| App | Services, Agents | Internal only |
| Data | Neo4j, Kafka, Redis | App tier only |
| SAP | S/4, GTS | SAP router / BTP destination |
| AI | Azure OpenAI | Private endpoint, no PII |

## 7. Document Index

| # | Document |
|---|----------|
| 1 | [01-ENTERPRISE-ARCHITECTURE.md](./01-ENTERPRISE-ARCHITECTURE.md) |
| 2 | [02-AI-AGENT-ARCHITECTURE.md](./02-AI-AGENT-ARCHITECTURE.md) |
| 3 | [03-KNOWLEDGE-GRAPH-MODEL.md](./03-KNOWLEDGE-GRAPH-MODEL.md) |
| 4 | [04-EVENT-DRIVEN-ARCHITECTURE.md](./04-EVENT-DRIVEN-ARCHITECTURE.md) |
| 5 | [05-SAP-INTEGRATION-ARCHITECTURE.md](./05-SAP-INTEGRATION-ARCHITECTURE.md) |
| 6 | [06-EXECUTIVE-COCKPIT-DESIGN.md](./06-EXECUTIVE-COCKPIT-DESIGN.md) |
| 7 | [07-AI-COPILOT-DESIGN.md](./07-AI-COPILOT-DESIGN.md) |
| 8 | [08-MULTI-AGENT-WORKFLOW.md](./08-MULTI-AGENT-WORKFLOW.md) |
| 9 | [09-ROADMAP-MVP3-TO-MVP5.md](./09-ROADMAP-MVP3-TO-MVP5.md) |
| 10 | This document |
