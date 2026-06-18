# Vue.js UI Design — AI-Assisted Planning Cockpit

## Design Principles

1. **Planner-first** — operational screens (Daily Planning, Line Optimization) before executive views  
2. **Explain, don't execute** — Copilot and agents show rationale; approve buttons are explicit  
3. **Enterprise Fiori** — shared `styles/enterprise-theme.css`, consistent typography  
4. **Human-in-the-loop** — every agent card shows `PENDING_APPROVAL` status and approver role  

## Navigation (Edition 3.0)

Defined in `cockpit/src/utils/plannerTerminology.js`:

| Group | Route | Label |
|-------|-------|-------|
| Planning | `/daily-planning` | Daily Planning |
| Planning | `/line-optimization` | Line Optimization |
| Intelligence | `/executive` | Executive Cockpit |
| Intelligence | `/agents` | Agent Console |
| Intelligence | `/copilot-v3` | Planning Copilot |

## Screen Designs

### 1. Daily Planning (`/daily-planning`)

**Purpose:** Morning operational overview for the local planner.

| Zone | Content |
|------|---------|
| KPI row | Open orders, at-risk, exceptions, recommended sequence slots |
| Recommendations | Line scores, sequencing hints from `planner-dashboard` API |
| Exception table | RMSL, Japan sequence, capacity conflicts |

**API:** `GET /api/v1/planning/planner-dashboard`

### 2. Line Optimization (`/line-optimization`)

**Purpose:** Create and confirm production sequences.

| Zone | Content |
|------|---------|
| Gantt | Multi-lane bars per production line (PrimeVue / custom) |
| Actions | Drag-drop reorder, Save Draft, Confirm Schedule |
| Sidebar | Order details, batch allocation status |

**API:** `GET /api/v5/planning/gantt`, `POST` sequencing confirm

### 3. Executive Cockpit (`/executive`)

**Purpose:** Management dashboard — KPIs, risks, agent recommendations with approval.

```
┌─────────────────────────────────────────────────────────┐
│  Executive Cockpit          Horizon: [7] [30] [90]      │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Service  │ Inv.Risk │ RMSL     │ Alloc %  │ Line Util % │
│ Level    │          │ Compl.   │          │             │
├─────────────────────────────────────────────────────────┤
│  Daily Summary: 52 open · 47 allocatable · 5 at risk  │
├──────────────────────┬──────────────────────────────────┤
│  Market Heatmap      │  Top RMSL Risks (T+7)            │
├──────────────────────┴──────────────────────────────────┤
│  Agent Recommendations                    [Run Agents]  │
│  ┌────────────────────────────────────────────────────┐ │
│  │ QA · PRIORITIZE_RELEASE · PO-20015    [✓] [✗]     │ │
│  │ SC · MARKET_TRANSFER · JP             [✓] [✗]     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**API:** `GET /api/v3/executive/dashboard`, approve/dismiss via `POST /api/v3/recommendations/:id/approve`

**File:** `cockpit/src/views/v3/ExecutiveCockpitView.vue`

### 4. Agent Console (`/agents`)

**Purpose:** Morning briefing + manual agent orchestration.

| Zone | Content |
|------|---------|
| Morning Briefing | Daily Planning Summary from Planning Agent |
| Run Controls | Trigger selector (`SCHEDULED_DAILY`, `MANUAL`), horizon days |
| Last Run | Agents executed, recommendation count |
| Graph Stats | Node/relationship counts from knowledge graph |

**API:** `GET /api/v3/agents/morning-briefing`, `POST /api/v3/agents/run`, `GET /api/v3/graph/stats`

**File:** `cockpit/src/views/v3/AgentConsoleView.vue`

### 5. Planning Copilot (`/copilot-v3`)

**Purpose:** Conversational explanations for planning decisions.

| Zone | Content |
|------|---------|
| Order context | Packaging Order ID input |
| Suggested chips | Pre-built questions (batch, line, move, alternate) |
| Chat panel | Question → answer with evidence bullets |
| Graph context | Linked countries, batch approvals (collapsible) |

**Example interaction:**

> **Planner:** Why was this batch selected?  
> **Copilot:** Batch BATCH-0021 was selected because it passed all compliance checks for DE. It is the oldest compliant batch (FIFO).  
> **Evidence:** Market Release approved · RMSL 18.2 mo above threshold · Quality RELEASED  

**API:** `POST /api/v3/copilot/ask`

**File:** `cockpit/src/views/v3/CopilotV3View.vue`

## API Client

`cockpit/src/api/v3.js` — wraps all v3 endpoints with auth headers from session.

## Component Stack

| Library | Usage |
|---------|-------|
| Vue 3 Composition API | All views |
| PrimeVue | DataTable, Card, Button, Toast, Tag |
| Chart.js | KPI trends (MVP 3.1) |
| Custom Gantt | Line optimization bars |

## State & Auth

- Role from `POST /api/v2/auth/login` stored in session  
- `X-User-Role` header on all API calls  
- Toast notifications for approve/dismiss feedback (`ToastService` in `main.js`)

## MVP 3.1 UI Enhancements

- World map heatmap (replace table)  
- Chart.js trend lines for KPIs  
- Agent Console: inline approve/dismiss  
- Copilot: action buttons → navigate to What-If / Line Optimization  
- WebSocket push when agents complete morning run  

## Accessibility & GMP UX

- Severity tags: CRITICAL (red), HIGH (orange), MEDIUM (blue)  
- Every recommendation shows `evidence[]` expandable panel  
- `advisorNote` banner on intelligence screens: "AI recommends — planner approves"  
- No auto-submit on copilot answers  
