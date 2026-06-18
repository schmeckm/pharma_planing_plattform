# Control Tower — Executive Presentation

## Slide 1: Title
**Global Supply Chain Control Tower**  
Hard Allocation Platform MVP 4.0  
Pharmaceutical Finished Goods & Bulk Inventory

---

## Slide 2: Business Challenge
- Fragmented visibility across plants, markets, and batches
- Reactive allocation — planners discover RMSL blocks too late
- No unified view of demand, inventory, and compliance risk
- Manual coordination between Planning, QA, and Supply Chain

---

## Slide 3: Solution Vision
**One platform. One truth. Proactive decisions.**

Single pane of glass for:
- Global Inventory (FG + Bulk)
- Market Demand & Forecast
- Allocation Status
- RMSL / TRIC / Compliance Risk
- Packaging Capacity
- Batch Expiry Exposure

---

## Slide 4: Architecture
```
Vue Control Tower → Node.js API v4 → Intelligence Layer → SAP S/4HANA
                  ↘ WebSocket (real-time)
                  ↘ Digital Twin (T+7/30/90)
                  ↘ Recommendation Engine
```

---

## Slide 5: Key Modules

| Module | Value |
|--------|-------|
| Global Inventory | Plant/country/batch visibility with RMSL |
| Market Demand | SO + forecast + backorders |
| Allocation Monitor | Open, blocked, pending decisions |
| Risk Control Center | Heatmaps, expiry, bottlenecks |
| Event Monitor | Real-time supply chain events |
| Recommendations | Transfer, reallocate, prioritize QA |

---

## Slide 6: KPI Dashboard

| KPI | Current (Demo) | Target |
|-----|----------------|--------|
| Service Level | 96.8% | ≥ 98% |
| RMSL Compliance | 83.3% | ≥ 99% |
| Inventory Coverage | 9.8x | ≥ 1.5x |
| Inventory at Risk | 10,000 EA | Minimize |

---

## Slide 7: Digital Twin
- Simulates allocation outcomes 7, 30, 90 days ahead
- Identifies at-risk markets before planners act
- Non-GxP decision support — human approval required

---

## Slide 8: Recommendation Engine
Automated suggestions for:
- Inventory transfers (CH → JP)
- Batch reallocation (RMSL compliance)
- QA prioritization (inspection lots)
- Packaging sequence optimization

**Governance:** All recommendations PENDING until approved.

---

## Slide 9: Technology Roadmap

| Phase | Capability |
|-------|------------|
| **MVP 4.0 (Now)** | Control Tower UI, JSON data, WebSocket |
| **MVP 4.1** | SAP OData read, Kafka events |
| **MVP 4.5** | SAP IBP demand, BTP integration |
| **MVP 5.0** | GxP-validated autonomous operations |

---

## Slide 10: Call to Action
1. Pilot with Basel Packaging Center (Plant 1000)
2. Connect SAP S/4 read interfaces
3. Train planners on Control Tower workflows
4. Measure KPI improvement over 90 days

**Demo:** http://localhost:3001/control-tower

---

## Appendix: Links

- Architecture: `docs/control-tower/01-ARCHITECTURE.md`
- API: `docs/control-tower/08-API-SPECIFICATIONS.md`
- KPI Definitions: `docs/control-tower/04-KPI-DEFINITIONS.md`
