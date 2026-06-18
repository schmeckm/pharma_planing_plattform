# Time Planning — Database Model

## Packaging Order (extended)

```json
{
  "packagingOrderId": "PO-20001",
  "processOrder": "10001234",
  "salesOrderId": "SO-10001",
  "plannedStartDate": "2026-09-01",
  "plannedEndDate": "2026-09-03",
  "actualStartDate": null,
  "actualEndDate": null,
  "releaseDate": "2026-08-28",
  "requestedDeliveryDate": "2026-09-15",
  "productionLine": "PACK_LINE_01",
  "priority": "HIGH",
  "market": "MKT-DE",
  "destinationCountry": "DE",
  "quantity": 5000,
  "status": "OPEN"
}
```

## Production Lines

`data/productionLines.json` — lineId, capacityUnitsPerDay, shiftPattern

## Line Calendars

`data/lineCalendars.json` — weekly calendars with:
- availableHours
- shiftPattern (shifts, hoursPerShift)
- plannedMaintenance[]

## SAP Mapping (Future)

| Field | SAP Source |
|-------|------------|
| processOrder | PP Process Order (AUFNR) |
| plannedStartDate/End | AFKO scheduled dates |
| productionLine | Work center (ARBPL) |
| releaseDate | Order release timestamp |
| requestedDeliveryDate | SO schedule line (VBEP) |

## Audit Extension

Allocation audit entries now include `timeRmsl` triple-point forecast when batch selected.
