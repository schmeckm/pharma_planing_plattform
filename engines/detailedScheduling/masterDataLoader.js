const fs = require('fs');
const path = require('path');
const { JsonRepository } = require('../../utils/jsonRepository');

const EU_COUNTRIES = new Set(['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PL', 'SE', 'DK', 'FI', 'IE', 'PT', 'GR', 'CZ', 'RO', 'HU', 'SK', 'BG', 'HR', 'SI', 'LT', 'LV', 'EE', 'CY', 'LU', 'MT', 'GB', 'CH']);

class MasterDataLoader {
  constructor(dataDir = null) {
    this._dir = dataDir || process.env.HAP_DATA_DIR || path.join(__dirname, '../../data');
    this._repo = new JsonRepository(this._dir);
  }

  _read(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this._dir, `${name}.json`), 'utf-8'));
    } catch {
      return { items: [] };
    }
  }

  loadAll() {
    const plants = this._read('plants').items || [];
    const productionLines = this._read('productionLines').items || [];
    const lineQualifications = this._read('lineQualifications').items || [];
    const materials = this._read('materials').items || [];
    const setupMatrix = this._read('setupMatrix');
    const batches = this._read('batches').items || [];
    const inspectionLots = this._read('inspectionLots').items || [];
    const lineCalendars = this._read('lineCalendars').items || [];
    const inventory = this._read('inventory').items || [];
    const markets = this._read('markets').items || [];
    const workCenters = this._read('workCenters').items || [];

    const materialByNumber = Object.fromEntries(materials.map((m) => [m.materialNumber, m]));
    const lineById = Object.fromEntries(productionLines.map((l) => [l.lineId, l]));
    const qualificationByLine = Object.fromEntries(lineQualifications.map((q) => [q.lineId, q]));
    const batchByMaterial = {};
    for (const b of batches) {
      const key = b.materialNumber;
      if (!batchByMaterial[key]) batchByMaterial[key] = [];
      batchByMaterial[key].push(b);
    }

    const roughOrders = (this._read('roughPlannedOrders').items || []).map((o) => this._toProductionOrder(o, materialByNumber));

    return {
      plants,
      productionLines,
      lineQualifications,
      materials,
      materialByNumber,
      setupMatrix,
      batches,
      batchByMaterial,
      inspectionLots,
      lineCalendars,
      inventory,
      markets,
      workCenters,
      lineById,
      qualificationByLine,
      productionOrders: roughOrders,
      euCountries: EU_COUNTRIES,
    };
  }

  _toProductionOrder(raw, materialByNumber) {
    const material = raw.material || raw.materialNumber;
    const meta = materialByNumber[material] || {};
    const setupHours = Math.max(0.5, Math.round(((raw.durationHours || 16) * 0.1) * 10) / 10);
    const productionHours = Math.max(1, (raw.durationHours || 16) - setupHours);
    return {
      orderNumber: raw.packagingOrder || raw.packagingOrderId,
      materialNumber: material,
      materialDescription: raw.materialDescription || meta.materialDescription || material,
      plant: raw.plant || '1000',
      packagingLine: raw.productionLine || raw.preferredLine,
      country: raw.destinationCountry,
      quantity: raw.quantity || 0,
      dueDate: raw.requestedDeliveryDate,
      priority: raw.priority || 'STANDARD',
      productionDurationHours: productionHours,
      setupDurationHours: setupHours,
      status: raw.planningStatus || 'OPEN',
      customerCritical: raw.priority === 'HIGH' && (raw.demoScenario === 'CRITICAL' || raw.sequencePosition === 1),
      regulatoryCritical: !!meta.regulatoryCritical,
      revenue: (raw.quantity || 0) * (meta.revenuePerUnit || 10),
      campaignGroup: meta.campaignGroup || material,
      colorFamily: meta.colorFamily || 'Clear',
      packageType: meta.packageType || 'Tablet',
      plannedStartDate: raw.plannedStartDate,
      plannedEndDate: raw.plannedEndDate,
    };
  }
}

module.exports = { MasterDataLoader, EU_COUNTRIES };
