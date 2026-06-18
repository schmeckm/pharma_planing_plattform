#!/usr/bin/env node
/**
 * Generate bulk pharmaceutical demo data for JSON-based MVP (no SAP).
 * Usage: node scripts/generate-demo-data.js [orderCount] [batchCount]
 * Default: 52 orders, 96 batches
 */
const fs = require('node:fs');
const path = require('node:path');

const ORDER_COUNT = parseInt(process.argv[2] || '60', 10);
const BATCH_COUNT = parseInt(process.argv[3] || '96', 10);
const HISTORICAL_COUNT = parseInt(process.argv[4] || '120', 10);
const DATA_DIR = process.env.HAP_DATA_DIR || path.join(__dirname, '../data');

const MATERIALS = [
  { id: 'DP-1000', desc: 'Product Alpha 100mg Tablets', family: 'ALPHA_TABLETS', lines: ['PACK_LINE_01', 'PACK_LINE_02'] },
  { id: 'DP-2000', desc: 'Product Beta 50mg Capsules', family: 'BETA_CAPSULES', lines: ['PACK_LINE_02', 'PACK_LINE_03'] },
  { id: 'DP-3000', desc: 'Product Gamma 250mg Injection', family: 'GAMMA_INJECT', lines: ['PACK_LINE_04'] },
  { id: 'DP-4000', desc: 'Product Delta 100ml Syrup', family: 'DELTA_SYRUP', lines: ['PACK_LINE_05'] },
  { id: 'DP-5000', desc: 'Product Epsilon 30g Cream', family: 'EPSILON_CREAM', lines: ['PACK_LINE_06'] },
];

const PACKAGING_MATERIALS = [
  { id: 'PM-1001', desc: 'Blister foil Alpha 200µm', drugProductId: 'DP-1000', unit: 'M2', batchManaged: true },
  { id: 'PM-1002', desc: 'Carton Alpha 120×80mm', drugProductId: 'DP-1000', unit: 'EA', batchManaged: false },
  { id: 'PM-2001', desc: 'Capsule shell Beta size 1', drugProductId: 'DP-2000', unit: 'EA', batchManaged: true },
  { id: 'PM-2002', desc: 'Label Beta 50mg', drugProductId: 'DP-2000', unit: 'EA', batchManaged: false },
  { id: 'PM-3001', desc: 'Vial Gamma 10ml', drugProductId: 'DP-3000', unit: 'EA', batchManaged: true },
  { id: 'PM-4001', desc: 'Bottle Delta 100ml', drugProductId: 'DP-4000', unit: 'EA', batchManaged: true },
  { id: 'PM-5001', desc: 'Tube Epsilon 30g', drugProductId: 'DP-5000', unit: 'EA', batchManaged: false },
];

const COUNTRIES = [
  { code: 'DE', market: 'MKT-DE', customer: 'PharmaCorp Germany', rmsl: 12, split: true, seq: false },
  { code: 'GB', market: 'MKT-GB', customer: 'MedSupply UK', rmsl: 18, split: false, seq: false },
  { code: 'JP', market: 'MKT-JP', customer: 'Nippon Pharma', rmsl: 24, split: false, seq: true },
  { code: 'CH', market: 'MKT-CH', customer: 'SwissMed AG', rmsl: 6, split: false, seq: false },
  { code: 'AT', market: 'MKT-AT', customer: 'AlpenPharma', rmsl: 12, split: true, seq: false },
  { code: 'FR', market: 'MKT-FR', customer: 'Santé France', rmsl: 15, split: true, seq: false },
  { code: 'US', market: 'MKT-US', customer: 'US BioHealth', rmsl: 18, split: false, seq: false },
  { code: 'IT', market: 'MKT-IT', customer: 'Italia Medica', rmsl: 14, split: true, seq: false },
  { code: 'NL', market: 'MKT-NL', customer: 'Benelux Pharma', rmsl: 12, split: true, seq: false },
  { code: 'AU', market: 'MKT-AU', customer: 'Pacific Health', rmsl: 20, split: false, seq: false },
];

const LINES = [
  { lineId: 'PACK_LINE_01', lineName: 'Packaging Line 01 — Tablets', capacity: 8000 },
  { lineId: 'PACK_LINE_02', lineName: 'Packaging Line 02 — Capsules', capacity: 6000 },
  { lineId: 'PACK_LINE_03', lineName: 'Packaging Line 03 — Blister', capacity: 5500 },
  { lineId: 'PACK_LINE_04', lineName: 'Packaging Line 04 — Parenteral', capacity: 4000 },
  { lineId: 'PACK_LINE_05', lineName: 'Packaging Line 05 — Liquid Fill', capacity: 7000 },
  { lineId: 'PACK_LINE_06', lineName: 'Packaging Line 06 — Topical', capacity: 5000 },
];

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const PLANT = '1000';
const ANCHOR = '2026-09-01';
const HOURS_PER_DAY = 8;

const SHIFTS = [
  { shiftId: 'SHIFT_1', shiftName: 'Frühschicht', hoursPerShift: 8 },
  { shiftId: 'SHIFT_2', shiftName: 'Spätschicht', hoursPerShift: 8 },
];

/** Schicht-Einfluss auf Ist-Laufzeit (>1 = langsamer in dieser Schicht). */
const SHIFT_DURATION_BIAS = {
  SHIFT_1: 1.0,
  SHIFT_2: 1.06,
};

/** Planned duration multiplier — >1 means line runs slower than plan (lower Leistungsgrad). */
const LINE_DURATION_BIAS = {
  PACK_LINE_01: 1.0,
  PACK_LINE_02: 1.08,
  PACK_LINE_03: 1.03,
  PACK_LINE_04: 0.96,
  PACK_LINE_05: 1.02,
  PACK_LINE_06: 1.14,
};

function write(name, data) {
  const p = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : data.items?.length ?? data.packagingOrders?.length ?? '?';
  console.log(`  ✓ ${name}.json (${count} records)`);
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function lineDurationBias(lineId) {
  return LINE_DURATION_BIAS[lineId] ?? 1.0;
}

function shiftDurationBias(shiftId) {
  return SHIFT_DURATION_BIAS[shiftId] ?? 1.0;
}

function pickShift(i) {
  return SHIFTS[i % SHIFTS.length];
}

function generateHistoricalOrders() {
  const salesOrders = [];
  const packagingOrders = [];

  for (let i = 0; i < HISTORICAL_COUNT; i++) {
    const n = i + 1;
    const poId = `FG-H${String(n).padStart(4, '0')}`;
    const soId = `SO-H${String(n).padStart(4, '0')}`;
    const mat = pick(MATERIALS, i);
    const country = pick(COUNTRIES, i + Math.floor(i / 5));
    const line = pick(mat.lines, i + 2);
    const shift = pickShift(i + Math.floor(i / 7));
    const priority = pick(PRIORITIES, i);
    const qty = [1500, 2500, 4000, 6000, 8000, 10000][i % 6];
    const daysBeforeAnchor = 7 + (i % 358);
    const durationDays = 1 + (i % 4);
    const plannedEnd = addDays(ANCHOR, -daysBeforeAnchor);
    const plannedStart = addDays(plannedEnd, -(durationDays - 1));
    const delivery = addDays(plannedEnd, 5 + (i % 10));

    const bias = lineDurationBias(line) * shiftDurationBias(shift.shiftId);
    const jitter = 0.92 + ((i * 17 + line.charCodeAt(10)) % 17) / 100;
    const plannedDurationHours = durationDays * HOURS_PER_DAY;
    const actualDurationHours = Math.round(plannedDurationHours * bias * jitter * 10) / 10;
    const actualDurationDays = Math.max(1, Math.ceil(actualDurationHours / HOURS_PER_DAY));
    const startSlipDays = (i % 3 === 0) ? 1 : 0;
    const actualStart = addDays(plannedStart, startSlipDays);
    const actualEnd = addDays(actualStart, actualDurationDays - 1);

    salesOrders.push({
      salesOrderId: soId,
      customerName: country.customer,
      destinationCountry: country.code,
      market: country.market,
      materialNumber: mat.id,
      materialDescription: mat.desc,
      quantity: qty,
      unit: 'EA',
      requestedDeliveryDate: delivery,
    });

    packagingOrders.push({
      packagingOrderId: poId,
      processOrder: String(10090000 + n),
      salesOrderId: soId,
      materialNumber: mat.id,
      materialDescription: mat.desc,
      packagingMaterialNumbers: packagingMaterialsForDrugProduct(mat.id),
      productFamily: mat.family,
      destinationCountry: country.code,
      market: country.market,
      quantity: qty,
      unit: 'EA',
      status: 'COMPLETED',
      priority,
      productionLine: line,
      shiftId: shift.shiftId,
      shiftName: shift.shiftName,
      releaseDate: addDays(plannedStart, -2),
      plannedStartDate: plannedStart,
      plannedEndDate: plannedEnd,
      actualStartDate: actualStart,
      actualEndDate: actualEnd,
      requestedDeliveryDate: delivery,
      plant: PLANT,
      allocatedBatchId: `BATCH-H${String((i % 48) + 1).padStart(4, '0')}`,
      allocatedQuantity: qty,
      plannedDurationHours,
      actualDurationHours,
      historical: true,
    });
  }

  return { salesOrders, packagingOrders };
}

function demoScenarioForIndex(i) {
  const mod = i % 10;
  if (mod === 9) return 'NO_COUNTRY_RULE';
  if (mod === 8) return 'ATP_SHORTAGE';
  if (mod === 7) return 'NO_BATCH';
  return null;
}

function generateOrders() {
  const salesOrders = [];
  const packagingOrders = [];
  const roughPlanned = [];

  for (let i = 0; i < ORDER_COUNT; i++) {
    const n = i + 1;
    const poId = `FG-${20000 + n}`;
    const soId = `SO-${10000 + n}`;
    const mat = pick(MATERIALS, i);
    const country = pick(COUNTRIES, i + Math.floor(i / 3));
    const line = pick(mat.lines, i);
    const shift = pickShift(i);
    const priority = pick(PRIORITIES, i);
    let qty = [2000, 3000, 5000, 8000, 10000, 12000][i % 6];
    const startOffset = Math.floor(i / 2);
    const durationDays = 2 + (i % 3);
    const plannedStart = addDays(ANCHOR, startOffset);
    const plannedEnd = addDays(plannedStart, durationDays - 1);
    const delivery = addDays(plannedEnd, 7 + (i % 14));

    const demoScenario = demoScenarioForIndex(i);
    let materialId = mat.id;
    let materialDesc = mat.desc;
    let destinationCountry = country.code;

    if (demoScenario === 'NO_COUNTRY_RULE') destinationCountry = 'ZZ';
    if (demoScenario === 'NO_BATCH') {
      materialId = 'DP-9999';
      materialDesc = 'Demo — no inventory (blocked)';
    }
    if (demoScenario === 'ATP_SHORTAGE') qty = 999999;

    salesOrders.push({
      salesOrderId: soId,
      customerName: country.customer,
      destinationCountry,
      market: country.market,
      materialNumber: materialId,
      materialDescription: materialDesc,
      quantity: qty,
      unit: 'EA',
      requestedDeliveryDate: delivery,
    });

    packagingOrders.push({
      packagingOrderId: poId,
      processOrder: String(10001000 + n),
      salesOrderId: soId,
      materialNumber: materialId,
      materialDescription: materialDesc,
      packagingMaterialNumbers: packagingMaterialsForDrugProduct(materialId),
      destinationCountry,
      market: country.market,
      quantity: qty,
      unit: 'EA',
      status: i % 17 === 0 ? 'PLANNED' : 'OPEN',
      priority,
      productionLine: line,
      shiftId: shift.shiftId,
      shiftName: shift.shiftName,
      plannedShiftId: shift.shiftId,
      releaseDate: addDays(plannedStart, -3),
      plannedStartDate: plannedStart,
      plannedEndDate: plannedEnd,
      actualStartDate: null,
      actualEndDate: null,
      requestedDeliveryDate: delivery,
      plant: PLANT,
      allocatedBatchId: null,
      allocatedQuantity: null,
      demoScenario,
    });

    roughPlanned.push({
      packagingOrder: poId,
      salesOrder: soId,
      material: materialId,
      materialDescription: materialDesc,
      destinationCountry,
      quantity: qty,
      priority,
      roughPlannedStart: `${plannedStart}T08:00:00`,
      roughPlannedEnd: `${plannedEnd}T16:00:00`,
      plannedStartDate: plannedStart,
      plannedEndDate: plannedEnd,
      actualStartDate: null,
      actualEndDate: null,
      requestedDeliveryDate: delivery,
      productionLine: line,
      preferredLine: line,
      shiftId: shift.shiftId,
      shiftName: shift.shiftName,
      plannedShiftId: shift.shiftId,
      durationHours: durationDays * 8,
      planningStatus: 'ROUGH',
      sequencePosition: null,
      demoScenario,
    });
  }

  return { salesOrders, packagingOrders, roughPlanned };
}

function countryApprovals(code) {
  const pools = {
    DE: ['DE', 'AT', 'NL'],
    GB: ['GB', 'IE'],
    JP: ['JP'],
    CH: ['CH', 'DE', 'AT'],
    AT: ['AT', 'DE'],
    FR: ['FR', 'BE'],
    US: ['US'],
    IT: ['IT'],
    NL: ['NL', 'DE', 'BE'],
    AU: ['AU'],
  };
  return pools[code] || [code, 'DE'];
}

function batchDates(index) {
  const month = String((index % 12) + 1).padStart(2, '0');
  const productionDate = `2025-${month}-10`;
  const expiry = new Date(`${productionDate}T12:00:00Z`);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 5);
  return {
    productionDate,
    expiryDate: expiry.toISOString().slice(0, 10),
  };
}

function countriesNeededForMaterial(openOrders, materialId) {
  const codes = new Set(
    openOrders
      .filter((o) => o.materialNumber === materialId && o.destinationCountry !== 'ZZ')
      .map((o) => o.destinationCountry),
  );
  return codes.size ? [...codes] : COUNTRIES.map((c) => c.code);
}

function scaleBatchQuantitiesForOpenOrders(batches, openOrders) {
  const need = {};
  for (const o of openOrders) {
    if (o.demoScenario === 'NO_BATCH' || o.demoScenario === 'NO_COUNTRY_RULE') continue;
    need[o.materialNumber] = (need[o.materialNumber] || 0) + o.quantity;
  }
  for (const materialNumber of Object.keys(need)) {
    const released = batches.filter(
      (b) => b.materialNumber === materialNumber && b.qualityStatus === 'RELEASED',
    );
    const have = released.reduce((s, b) => s + b.availableQuantity, 0);
    const target = Math.ceil(need[materialNumber] * 1.4);
    if (have >= target || !released.length) continue;
    const factor = target / have;
    for (const b of released) {
      b.quantity = Math.ceil(b.quantity * factor);
      b.availableQuantity = b.quantity;
    }
  }
  return batches;
}

function generateBatches(openOrders) {
  const perMat = Math.max(8, Math.floor(BATCH_COUNT / MATERIALS.length));
  const items = [];
  let idx = 0;

  for (const mat of MATERIALS) {
    const approved = countriesNeededForMaterial(openOrders, mat.id);
    const jpSlots = approved.includes('JP');

    for (let j = 0; j < perMat; j++) {
      idx += 1;
      const { productionDate, expiryDate } = batchDates(idx);
      const isBlocked = idx % 37 === 0;
      const qty = 10000 + (j % 4) * 5000;

      items.push({
        batchId: `BATCH-${String(idx).padStart(4, '0')}`,
        materialNumber: mat.id,
        materialDescription: mat.desc,
        quantity: qty,
        availableQuantity: isBlocked ? 0 : qty,
        unit: 'EA',
        productionDate,
        expiryDate,
        qualityStatus: isBlocked ? 'BLOCKED' : 'RELEASED',
        approvedCountries: approved,
        plant: PLANT,
        batchSequence: jpSlots && j < 8 ? j + 1 : null,
        storageLocation: String(1000 + (idx % 5)).padStart(4, '0'),
      });
    }
  }

  return scaleBatchQuantitiesForOpenOrders(items, openOrders);
}

function generateInventory(batches) {
  return batches
    .filter((b) => b.qualityStatus === 'RELEASED')
    .map((b, i) => ({
      inventoryId: `INV-${String(i + 1).padStart(4, '0')}`,
      batchId: b.batchId,
      materialNumber: b.materialNumber,
      quantity: b.quantity,
      availableQuantity: b.availableQuantity,
      reservedQuantity: 0,
      atpQuantity: b.availableQuantity,
      plant: b.plant,
      storageLocation: b.storageLocation,
    }));
}

function packagingMaterialsForDrugProduct(drugProductId) {
  return PACKAGING_MATERIALS.filter((pm) => pm.drugProductId === drugProductId).map((pm) => pm.id);
}

function generatePackagingMaterials() {
  return { items: PACKAGING_MATERIALS };
}

function generateBulkInventory() {
  return {
    items: [
      { bulkId: 'BULK-001', materialNumber: 'DP-1000-BULK', materialDescription: 'Product Alpha Bulk Granulate', plantId: '2000', quantity: 50000, availableQuantity: 42000, allocatedQuantity: 8000, blockedQuantity: 0, unit: 'KG', expiryDate: '2028-12-01', qualityStatus: 'RELEASED' },
      { bulkId: 'BULK-002', materialNumber: 'DP-2000-BULK', materialDescription: 'Product Beta Bulk Powder', plantId: '2000', quantity: 30000, availableQuantity: 25000, allocatedQuantity: 5000, blockedQuantity: 0, unit: 'KG', expiryDate: '2029-03-15', qualityStatus: 'RELEASED' },
      { bulkId: 'BULK-003', materialNumber: 'DP-1000-BULK', materialDescription: 'Product Alpha Bulk Granulate', plantId: '2000', quantity: 10000, availableQuantity: 0, allocatedQuantity: 0, blockedQuantity: 10000, unit: 'KG', expiryDate: '2026-09-01', qualityStatus: 'BLOCKED', blockReason: 'QA_HOLD' },
    ],
  };
}

function generateAtpReservations() {
  return {
    items: [
      {
        reservationId: 'RES-DEMO-001',
        batchId: 'BATCH-0001',
        reservedQuantity: 500,
        reservedForOrderId: 'FG-20005',
        reservedForCountry: 'DE',
        status: 'ACTIVE',
        reason: 'Demo reservation — small ATP headroom reduction',
      },
    ],
  };
}

function generateLines() {
  return LINES.map((l) => ({
    lineId: l.lineId,
    lineName: l.lineName,
    plantId: PLANT,
    capacityUnitsPerDay: l.capacity,
    shiftPattern: '2_SHIFT',
    active: true,
  }));
}

function generateCalendars() {
  const items = [];
  const weeks = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'];
  for (const line of LINES) {
    for (const week of weeks) {
      items.push({
        lineId: line.lineId,
        weekStarting: week,
        availableHours: 96,
        plannedMaintenance: line.lineId === 'PACK_LINE_01' && week === '2026-09-08'
          ? [{ date: '2026-09-10', hours: 8, reason: 'Line sanitization' }]
          : [],
        shiftPattern: { shifts: 2, hoursPerShift: 8 },
        maxUnitsPerDay: line.capacity,
      });
    }
  }
  return items;
}

function generatePerformance() {
  const items = [];
  for (const mat of MATERIALS) {
    for (const lineId of mat.lines) {
      const line = LINES.find((l) => l.lineId === lineId);
      const seed = mat.id.charCodeAt(4) + lineId.charCodeAt(10);
      items.push({
        materialNumber: mat.id,
        productFamily: mat.family,
        lineId,
        lineName: line?.lineName || lineId,
        runs: 20 + (seed % 40),
        averageOee: 55 + (seed % 35),
        averageThroughput: 200 + (seed % 400),
        averageYield: 93 + (seed % 6),
        averageSetupMinutes: 30 + (seed % 90),
        averageDowntimeMinutes: 5 + (seed % 30),
        reliability: 75 + (seed % 22),
        onTimeDeliveryPercent: 78 + (seed % 18),
        lastUpdated: '2026-05-01T00:00:00Z',
      });
    }
  }
  return items;
}

function generateInspectionLots(batches) {
  const released = batches.filter((b) => b.qualityStatus === 'RELEASED').slice(0, 24);
  const pending = batches.filter((b) => b.qualityStatus === 'BLOCKED').slice(0, 6);
  const items = [];
  let lotNum = 90000;
  for (const b of released) {
    items.push({
      lotId: `IL-${lotNum++}`,
      batchId: b.batchId,
      materialNumber: b.materialNumber,
      status: 'RELEASED',
      usageDecision: 'A',
      createdDate: b.productionDate,
      releaseDate: b.productionDate,
      expectedReleaseDate: null,
    });
  }
  for (const b of pending) {
    items.push({
      lotId: `IL-${lotNum++}`,
      batchId: b.batchId,
      materialNumber: b.materialNumber,
      status: 'PENDING',
      createdDate: '2026-06-01',
      expectedReleaseDate: addDays(ANCHOR, 1 + (lotNum % 5)),
    });
  }
  return items;
}

function generateForecasts() {
  return COUNTRIES.map((c, i) => ({
    forecastId: `FC-${c.code}-2026-Q3`,
    marketId: c.market,
    materialNumber: pick(MATERIALS, i).id,
    period: '2026-Q3',
    forecastQuantity: 8000 + i * 2500,
    unit: 'EA',
  }));
}

function generatePlanningExceptions(orders) {
  const types = [
    { type: 'CAPACITY_CONFLICT', label: 'Capacity Conflict' },
    { type: 'NO_ELIGIBLE_BATCH', label: 'No Eligible Batch' },
    { type: 'ATP_SHORTAGE', label: 'ATP Shortage' },
    { type: 'JAPAN_SEQUENCE_VIOLATION', label: 'Sequence Check Violation' },
    { type: 'RMSL_VIOLATION', label: 'Shelf-Life Risk' },
    { type: 'MARKET_RELEASE_VIOLATION', label: 'Market Release Violation' },
  ];
  return types.map((t, i) => {
    const po = orders.packagingOrders[i * 3] || orders.packagingOrders[i];
    return {
      exceptionId: `PLAN-EXC-${String(i + 1).padStart(3, '0')}`,
      type: t.type,
      typeLabel: t.label,
      packagingOrderId: po.packagingOrderId,
      destinationCountry: po.destinationCountry,
      productionLine: po.productionLine,
      status: i % 4 === 0 ? 'IN_REVIEW' : 'OPEN',
      severity: i % 3 === 0 ? 'CRITICAL' : 'HIGH',
      riskScore: 35 + i * 5,
      message: `${t.label} detected during daily planning review for ${po.packagingOrderId}`,
      plannedStartDate: po.plannedStartDate,
      plannedEndDate: po.plannedEndDate,
      source: 'PLANNING',
      createdAt: '2026-06-01T08:00:00Z',
      updatedAt: '2026-06-01T08:00:00Z',
    };
  });
}

function extendCountryRules() {
  const p = path.join(DATA_DIR, 'rules.json');
  const rules = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const existing = new Set((rules.countryRules || []).map((r) => r.countryCode));
  for (const c of COUNTRIES) {
    if (existing.has(c.code)) continue;
    rules.countryRules.push({
      countryCode: c.code,
      countryName: c.customer.split(' ')[0],
      allowBatchSplit: c.split,
      rmslThresholdMonths: c.rmsl,
      requiresTric: true,
      requiresContinuousSequence: c.seq,
      active: true,
    });
  }
  fs.writeFileSync(p, JSON.stringify(rules, null, 2));
  console.log(`  ✓ rules.json (country rules: ${rules.countryRules.length})`);
}

function printEligibilitySummary(openOrders, batches) {
  const { SchedulingService } = require('../services/schedulingService');
  const svc = new SchedulingService();
  const result = svc.evaluateConstraints();
  const pct = result.summary.total
    ? Math.round((result.summary.eligible / result.summary.total) * 100)
    : 0;
  console.log(`\n  Constraint check: ${result.summary.eligible}/${result.summary.total} eligible (${pct}%)`);
  console.log(`    blocked=${result.summary.blocked} atpFailed=${result.summary.atpFailed} tricFailed=${result.summary.tricFailed} rmslFailed=${result.summary.rmslFailed}`);
  const scenarios = openOrders.reduce((acc, o) => {
    const key = o.demoScenario || 'ELIGIBLE_TARGET';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log('    demo scenarios:', scenarios);
  return result.summary;
}

function main() {
  console.log(`\nGenerating demo data — ${HISTORICAL_COUNT} historical + ${ORDER_COUNT} future orders, ${BATCH_COUNT} batches\n`);

  const historical = generateHistoricalOrders();
  const future = generateOrders();
  const openOrders = future.packagingOrders.filter((o) => o.status === 'OPEN' || o.status === 'PLANNED');
  const orders = {
    salesOrders: [...historical.salesOrders, ...future.salesOrders],
    packagingOrders: [...historical.packagingOrders, ...future.packagingOrders],
    roughPlanned: future.roughPlanned,
  };
  const batches = generateBatches(openOrders);

  const { HistoricalOrderPerformanceEngine } = require('../engines/historicalOrderPerformanceEngine');
  const lines = generateLines();
  const perfAnalysis = HistoricalOrderPerformanceEngine.analyze(
    orders.packagingOrders,
    lines,
    { referenceDate: addDays(ANCHOR, -1) },
  );
  const perf = perfAnalysis.historicalPerformanceRecords.length
    ? perfAnalysis.historicalPerformanceRecords
    : generatePerformance();

  write('orders', orders);
  write('packagingOrders', { items: orders.packagingOrders });
  write('salesOrders', { items: orders.salesOrders });
  write('roughPlannedOrders', { items: orders.roughPlanned });
  write('batches', { items: batches });
  write('inventory', { items: generateInventory(batches) });
  write('atpReservations', generateAtpReservations());
  write('packagingMaterials', generatePackagingMaterials());
  write('bulkInventory', generateBulkInventory());
  write('productionLines', { items: lines.map((l) => {
    const derived = perfAnalysis.byLine.find((b) => b.lineId === l.lineId);
    return {
      ...l,
      performanceFactor: derived?.longTermFactor ?? 1,
      performanceFactorReason: derived
        ? `Abgeleitet aus ${derived.historicalRunsLong} historischen Aufträgen (OEE ${derived.longTermOee ?? '—'}%)`
        : 'Baseline',
      performanceFactorUpdatedAt: new Date().toISOString(),
      performanceFactorUpdatedBy: 'HISTORICAL_ANALYSIS',
    };
  }) });
  write('lineCalendars', { items: generateCalendars() });
  write('linePerformance', { repositoryVersion: '1.0.0', items: perf });
  write('historicalPerformance', { repositoryVersion: '1.0.0', items: perf });
  write('inspectionLots', { items: generateInspectionLots(batches) });
  write('forecasts', { items: generateForecasts() });
  write('planningExceptions', { repositoryVersion: '1.0.0', items: generatePlanningExceptions(orders) });
  write('optimizedSchedule', { items: [], status: 'DRAFT', label: 'Not confirmed — run Production Sequencing' });

  extendCountryRules();

  printEligibilitySummary(openOrders, batches);

  console.log(`\nDone. Restart API (npm start) and refresh cockpit.\n`);
}

main();
