const { JsonRepository } = require('../utils/jsonRepository');

class MaterialPlanningOwnershipService {
  constructor(repository = new JsonRepository()) {
    this.repository = repository;
    this._cache = null;
  }

  _load() {
    if (!this._cache) {
      const data = this.repository.read('materialPlanningOwnership') || { items: [] };
      this._cache = data.items || [];
    }
    return this._cache;
  }

  refresh() {
    this._cache = null;
    return this._load();
  }

  list() {
    return this._load();
  }

  getByMaterial(materialNumber) {
    if (!materialNumber) return null;
    return this._load().find((row) => row.materialNumber === materialNumber) || null;
  }

  resolveForOrder(order = {}) {
    const material = order.material || order.materialNumber;
    return this.getByMaterial(material);
  }

  /** Materials owned by user as MRP controller or detailed scheduler. */
  materialsForUser(userId) {
    if (!userId) return [];
    return this._load().filter(
      (row) => row.mrpControllerUserId === userId || row.detailedSchedulerUserId === userId,
    );
  }

  userPlanningRoles(userId) {
    const rows = this.materialsForUser(userId);
    return {
      mrpControllerIds: [...new Set(rows.map((r) => r.mrpController).filter(Boolean))],
      schedulerIds: [...new Set(rows.map((r) => r.detailedScheduler).filter(Boolean))],
      portfolios: [...new Set(rows.map((r) => r.productPortfolio).filter(Boolean))],
      lines: [...new Set(rows.map((r) => r.primaryLine).filter(Boolean))],
    };
  }
}

module.exports = { MaterialPlanningOwnershipService };
