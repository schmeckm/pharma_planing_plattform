# MVP 3.0 — Executive Cockpit Design

## 1. Audience & Purpose

**Audience:** VP Supply Chain, Site Heads, QA Directors, Market Access  
**Purpose:** Strategic visibility into global allocation risk before operational issues escalate

## 2. Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXECUTIVE COCKPIT — Global Allocation Intelligence          [T+7 ▼] [Export]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│ │ Global   │ │ Inventory│ │ RMSL     │ │ Blocked  │ │ Service  │ │ Agent  ││
│ │ Risk     │ │ Exposure │ │ Compliance│ │ Orders  │ │ Level   │ │ Actions││
│ │  HIGH 23 │ │ €4.2M   │ │ 94.2%   │ │ 47      │ │ 96.8%   │ │ 12 pend││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
├──────────────────────────────────┬──────────────────────────────────────────┤
│  COUNTRY RISK HEATMAP (world map) │  ALLOCATION PERFORMANCE (trend)        │
│  JP ████ HIGH  DE ██ MED  GB █ LOW│  ─── Success Rate  ─── Blocked Rate    │
├──────────────────────────────────┴──────────────────────────────────────────┤
│  TOP RISKS (Predictive T+30)          │  AGENT RECOMMENDATIONS (pending)     │
│  1. JP sequence gap in 14 days        │  • Move PO-20004 +2 days [Planning]  │
│  2. CH RMSL cliff — 3 batches         │  • Prioritize IL-90001 [QA]          │
│  3. DE TRIC renewal — MAT-1000        │  • Rebalance CH→JP 5000 EA [SC]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. KPI Definitions

| KPI | Formula | Source |
|-----|---------|--------|
| Global Allocation Risk | Weighted avg of market risk scores | Predictive Risk Engine |
| Inventory Exposure | Σ (batch qty × unit cost at risk) | Twin + MM |
| RMSL Compliance | % orders with RMSL margin > threshold | Twin T+7 |
| Blocked Orders | Count status=FAILED + open exceptions | Exception Queue |
| Service Level | Allocated on time / total due | Twin vs actual |
| Agent Actions Pending | Recommendations awaiting approval | Agent Orchestrator |

## 4. Country Risk Heatmap

| Color | Risk Level | Criteria |
|-------|------------|----------|
| Green | LOW | All T+7 projections pass |
| Amber | MEDIUM | 1-3 at-risk orders or batches |
| Red | HIGH | Sequence gap, TRIC gap, or RMSL cliff |

**Interaction:** Click country → drill to market detail + agent recommendations

## 5. Time Horizon Selector

| View | Data Source |
|------|-------------|
| T+7 | Digital Twin daily projection |
| T+30 | Predictive Risk monthly |
| T+90 | Strategic inventory exposure |

## 6. API Endpoints (v3)

```
GET /api/v3/executive/dashboard?horizon=7
GET /api/v3/executive/heatmap?horizon=30
GET /api/v3/executive/kpis
GET /api/v3/executive/agent-recommendations?status=pending
```

## 7. Refresh Strategy

- KPIs: 15-minute cache + event invalidation
- Heatmap: Twin run on schedule + on inventory events
- Agent recommendations: Real-time via WebSocket (MVP 4)

## 8. Access Control

| Role | Access |
|------|--------|
| VIEWER | Read-only dashboard |
| PLANNER | + drill-down to orders |
| ADMIN | + export, configure thresholds |
| Executive (custom) | Dashboard only, no operational detail |

## 9. Vue Implementation Plan

- New route: `/executive`
- PrimeVue + Chart.js + vue-world-map (or D3 choropleth)
- Pinia store: `executiveStore.js`
