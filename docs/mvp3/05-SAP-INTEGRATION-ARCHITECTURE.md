# MVP 3.0 — Future SAP Integration Architecture

## 1. Integration Principles

| Principle | Rationale |
|-----------|-----------|
| SAP = System of Record | All allocations confirmed in SAP |
| Platform = Decision Intelligence | Twin, agents, optimization run outside SAP |
| Event-first, API-second | Real-time via Event Mesh; batch via OData |
| Idempotent posting | Retry-safe BAPI/OData calls |
| GMP traceability | Every SAP write linked to platform audit ID |

## 2. SAP Module Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│                    HARD ALLOCATION PLATFORM                      │
│  Agents │ Twin │ Graph │ Optimization │ Copilot                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ IDataProvider + Event Adapters
┌────────────────────────────▼────────────────────────────────────┐
│                      INTEGRATION HUB                             │
│  OData Gateway │ RFC Adapter │ Event Mesh │ IDoc (legacy)       │
└────────────────────────────┬────────────────────────────────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    ▼                        ▼                        ▼
┌─────────┐           ┌─────────┐           ┌─────────┐
│ SAP SD  │           │ SAP PP  │           │ SAP MM  │
│ Sales   │           │ Packing │           │ Batch   │
│ Orders  │           │ Orders  │           │ Inv.    │
└─────────┘           └─────────┘           └─────────┘
    │                        │                        │
    ▼                        ▼                        ▼
┌─────────┐           ┌─────────┐           ┌─────────┐
│ SAP GTS │           │ SAP QM  │           │ SAP EWM │
│ TRIC    │           │ Insp.   │           │ WH Mgmt │
└─────────┘           └─────────┘           └─────────┘
```

## 3. OData Service Catalog (Target)

| CDS View / Service | Entity | Platform Use |
|--------------------|--------|--------------|
| `ZAPI_PACKAGING_ORDER` | PackagingOrder | Orders, Twin |
| `ZAPI_SALES_ORDER` | SalesOrder | SO linkage, delivery urgency |
| `ZAPI_FG_BATCH` | Batch | Inventory, RMSL, TRIC |
| `ZAPI_TRIC_APPROVAL` | TricApproval | Compliance Agent |
| `ZAPI_INSPECTION_LOT` | InspectionLot | QA Agent |
| `ZAPI_COUNTRY_RULE` | CountryRule | Rule sync (optional) |
| `ZAPI_ALLOC_CONFIRM` | AllocationResult | Execute posting |

## 4. RFC/BAPI Operations

| Operation | BAPI/RFC | Direction |
|-----------|----------|-----------|
| Confirm allocation | `BAPI_GOODSMVT_CREATE` + custom Z | Platform → SAP |
| Reserve batch | `BAPI_BATCH_RESERVE` | Platform → SAP |
| Read batch TRIC | `Z_RFC_TRIC_READ` | SAP → Platform |
| Release inspection | `BAPI_INSPLOT_SETUSAGEDECISION` | QA Agent → SAP (approval gated) |

## 5. Packing System Integration

```
Sales Order (SAP SD)
       │
       ▼
Packing Planning System ──► Packaging Order (Make-to-Stock)
       │                           │
       │                           ▼
       └──────────────► Hard Allocation Platform
                              │
                              ▼
                        Batch Assignment
                              │
                              ▼
                        SAP Confirmation
```

**Key linkage:** `packagingOrderId` ↔ `salesOrderId` ↔ `destinationCountry`

## 6. Event Mesh Subscriptions

| SAP Event | Platform Handler |
|-----------|------------------|
| `sap.sd.salesorder.changed.v1` | Graph sync, Twin refresh |
| `sap.mm.batch.statuschanged.v1` | QA Agent trigger |
| `sap.qm.inspectionlot.completed.v1` | QA Agent, Twin |
| `sap.gts.tric.approval.updated.v1` | Compliance Agent |

## 7. Security

- **SAP BTP Destination** with OAuth2 client credentials
- **Principal propagation** for user-audited actions
- **SAP GRC** role mapping to platform RBAC

## 8. MVP Evolution

| MVP | SAP Integration Level |
|-----|----------------------|
| 1.0 | JSON mock |
| 2.0 | IDataProvider + SAPODataProvider mock |
| 3.0 | OData read (orders, batches) + Event Mesh shadow |
| 4.0 | Full OData + allocation write-back |
| 5.0 | Validated GxP integration package |
