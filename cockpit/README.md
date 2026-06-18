# Hard Allocation Cockpit — Vue 3 Frontend

Professional SAP Fiori-style **Hard Allocation Cockpit** for pharmaceutical batch allocation to packaging orders.

## Technology

| Layer | Stack |
|-------|-------|
| Framework | Vue 3 (Composition API) |
| Build | Vite 5 |
| State | Pinia |
| HTTP | Axios |
| UI | Element Plus |
| Charts | Chart.js + vue-chartjs |

## Layout

- White content area on light grey canvas
- Dark navy left sidebar (`#1d2d3e`)
- SAP blue accent (`#0a6ed1`)
- KPI cards across the top on Dashboard
- Central order simulation table
- Right-side simulation detail panel
- Management-ready enterprise styling

## Pages

1. **Dashboard** — KPIs, recommendations table, country donut chart, quick actions
2. **Simulation** — Order table + detail panel (Save / Execute / Close)
3. **Orders** — Packaging orders with sales order linkage
4. **Allocations** — Allocation results from audit trail
5. **Batch Inventory** — Batches with RMSL / TRIC / quality
6. **Rules & Countries** — Configurable country and engine rules
7. **Reports** — Summary statistics by country
8. **Audit Trail** — Expandable rule-level traceability
9. **Administration** — Data source and integration settings

## Quick Start

```bash
cd cockpit
npm install
npm run dev
```

Open http://localhost:3001

### Connect to Node.js Backend

1. Start the backend from project root: `npm start` (port 8000)
2. Create `.env`:

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api/v1
```

3. Vite dev server proxies `/api` → `http://localhost:8000`

### Mock Data Mode (default)

By default `VITE_USE_MOCK` is enabled. All API calls use `src/mock/data.js` with the same shapes as the backend, so UI development works without the server.

## Project Structure

```
cockpit/
├── src/
│   ├── api/              # Axios client + API functions (mock/API switch)
│   ├── mock/             # Mock data (same shape as backend)
│   ├── stores/           # Pinia stores (app, orders, simulation)
│   ├── router/           # Vue Router
│   ├── layouts/          # CockpitLayout (sidebar + header)
│   ├── components/
│   │   ├── layout/       # AppSidebar, AppHeader
│   │   ├── dashboard/    # KpiCard, QuickActions
│   │   ├── simulation/   # OrderSimulationTable, SimulationDetailPanel
│   │   ├── charts/       # CountryDonutChart
│   │   └── shared/       # StatusTag
│   ├── views/            # 9 page views
│   └── styles/           # Fiori-style CSS variables
├── vite.config.js
└── package.json
```

## Backend API Endpoints

| Method | Endpoint |
|--------|----------|
| GET | `/api/v1/orders` |
| GET | `/api/v1/batches` |
| POST | `/api/v1/allocation/simulate` |
| POST | `/api/v1/allocation/execute` |
| POST | `/api/v1/allocation/mass-simulate` |
| GET | `/api/v1/audit-trail` |
| GET | `/api/v1/rules` |
| PUT | `/api/v1/rules` |

## Simulation Detail Panel

Shows for selected packaging order:

- Packaging Order / Sales Order / Country / Quantity / Delivery Date
- Batch Split Allowed / Minimum RMSL / Sequence Rule
- Recommended Batch / RMSL / Available Quantity
- Actions: **Save Simulation**, **Execute Allocation**, **Close**

## Production Build

```bash
npm run build
npm run preview
```

## Docker (with backend)

From project root, extend `docker-compose.yml` to include the cockpit service, or build standalone:

```bash
cd cockpit && npm run build
# Serve dist/ via nginx with /api proxy to backend
```

## License

Proprietary — Internal MVP
