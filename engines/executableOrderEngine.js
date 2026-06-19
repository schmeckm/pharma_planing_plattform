/**
 * Prüft, ob ein Grobplan-Auftrag plantseitig ausführbar ist (leichtgewichtig, ohne Solver).
 */

const EXECUTABLE = 'EXECUTABLE';
const BLOCKED = 'BLOCKED';
const PARTIAL = 'PARTIAL';

class ExecutableOrderEngine {
  constructor(repository) {
    this.repository = repository;
    this._ctx = null;
  }

  _loadContext() {
    if (this._ctx) return this._ctx;
    const lines = new Set(
      (this.repository.readArray('productionLines') || []).map((l) => l.lineId || l.id),
    );
    const materials = new Set(
      (this.repository.readArray('materials') || []).map((m) => m.materialNumber || m.material),
    );
    const tricApproved = new Set();
    for (const t of this.repository.readArray('tricCases') || []) {
      if (t.status === 'APPROVED') {
        tricApproved.add(`${t.materialNumber}|${t.country}`);
      }
    }
    this._ctx = { lines, materials, tricApproved };
    return this._ctx;
  }

  assess(order) {
    const ctx = this._loadContext();
    const blockReasons = [];
    const material = order.material || order.materialNumber || order.finishedGoodMaterial;
    const line = order.productionLine || order.preferredLine;
    const country = order.destinationCountry;

    if (!material) {
      blockReasons.push({ code: 'MISSING_MATERIAL', message: 'Kein Material angegeben' });
    } else if (!ctx.materials.has(material)) {
      blockReasons.push({ code: 'UNKNOWN_MATERIAL', message: `Material ${material} nicht in Stammdaten` });
    }

    if (!line) {
      blockReasons.push({ code: 'MISSING_LINE', message: 'Keine Verpackungslinie zugeordnet' });
    } else if (ctx.lines.size && !ctx.lines.has(line)) {
      blockReasons.push({ code: 'UNKNOWN_LINE', message: `Linie ${line} nicht in Kapazitätsstamm` });
    }

    if (!order.plannedStartDate || !order.plannedEndDate) {
      blockReasons.push({ code: 'MISSING_DATES', message: 'Start- oder Enddatum fehlt' });
    }

    if (!order.durationHours && order.durationHours !== 0) {
      blockReasons.push({ code: 'MISSING_DURATION', message: 'Dauer (durationHours) fehlt' });
    }

    if (material && country) {
      const tricKey = `${material}|${country}`;
      if (!ctx.tricApproved.has(tricKey)) {
        blockReasons.push({
          code: 'TRIC_NOT_APPROVED',
          message: `Kein freigegebenes TRIC für ${material} / ${country}`,
        });
      }
    }

    let executableStatus = EXECUTABLE;
    if (blockReasons.some((r) => ['MISSING_MATERIAL', 'MISSING_LINE', 'MISSING_DATES', 'TRIC_NOT_APPROVED'].includes(r.code))) {
      executableStatus = BLOCKED;
    } else if (blockReasons.length) {
      executableStatus = PARTIAL;
    }

    return {
      executableStatus,
      blockReasons,
      executable: executableStatus === EXECUTABLE,
    };
  }

  assessMany(orders) {
    return orders.map((order) => ({ ...order, ...this.assess(order) }));
  }

  summarize(orders) {
    const assessed = this.assessMany(orders);
    const total = assessed.length;
    const executable = assessed.filter((o) => o.executableStatus === EXECUTABLE).length;
    const blocked = assessed.filter((o) => o.executableStatus === BLOCKED).length;
    const partial = assessed.filter((o) => o.executableStatus === PARTIAL).length;
    const executableRate = total ? Math.round((executable / total) * 1000) / 10 : 0;
    return { total, executable, blocked, partial, executableRate, orders: assessed };
  }
}

module.exports = { ExecutableOrderEngine, EXECUTABLE, BLOCKED, PARTIAL };
