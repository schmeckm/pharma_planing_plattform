# Control Tower — Vue.js Component Structure

## Directory Layout

```
cockpit/src/
├── api/
│   └── v4.js                    # REST + WebSocket client
├── stores/
│   └── controlTower.js          # Pinia store (dashboard, WS)
├── views/v4/
│   └── ControlTowerView.vue     # Main Control Tower (tabbed)
├── components/
│   ├── dashboard/
│   │   └── KpiCard.vue          # Reused KPI tile
│   ├── shared/
│   │   └── RiskBadge.vue        # Reused risk tag
│   └── control-tower/           # (future sub-components)
│       ├── InventoryPanel.vue
│       ├── DemandPanel.vue
│       ├── AllocationPanel.vue
│       ├── RiskHeatmap.vue
│       ├── EventFeed.vue
│       └── RecommendationList.vue
```

## Route

```javascript
{ path: 'control-tower', name: 'ControlTower',
  component: () => import('@/views/v4/ControlTowerView.vue'),
  meta: { title: 'Control Tower', edition: '4.0' } }
```

## ControlTowerView Structure

```
ControlTowerView
├── Header (subtitle, live tag, horizon selector, refresh)
├── KPI Grid (6 executive KPIs)
└── TabView
    ├── Global Inventory (charts + batch table)
    ├── Market Demand (charts + SO table)
    ├── Allocation Monitor (stats + pending table)
    ├── Risk Control (heatmap + expiry table)
    ├── Events (event feed table)
    ├── Digital Twin (projection summary)
    └── Recommendations (action table)
```

## Store API

```javascript
const store = useControlTowerStore();
await store.loadDashboard(7);
store.connectWs();       // live KPI updates
store.disconnectWs();
```

## PrimeVue Components Used

| Component | Usage |
|-----------|-------|
| TabView / TabPanel | Module navigation |
| Card | Panel containers |
| Chart | Plant/country/demand charts |
| DataTable | Batch, SO, events, recommendations |
| Tag / RiskBadge | Severity indicators |
| SelectButton | Horizon selector |
| ProgressSpinner | Loading state |

## Future Component Split

Extract tab content into `components/control-tower/*` when adding drill-down modals and filters.

## Sidebar Entry

`AppSidebar.vue` → Control Tower (badge 4.0) at `/control-tower`
