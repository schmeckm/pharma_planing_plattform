class ScheduleImpactEngine {
  compare(before, after) {
    const beforeMap = Object.fromEntries(before.map((o) => [o.packagingOrder || o.packagingOrderId, o]));
    const afterMap = Object.fromEntries(after.map((o) => [o.packagingOrder || o.packagingOrderId, o]));

    const moved = [];
    const rmslChanges = [];
    const riskDelta = { before: 0, after: 0 };

    for (const id of Object.keys(afterMap)) {
      const b = beforeMap[id];
      const a = afterMap[id];
      if (!b) continue;

      if (b.productionLine !== a.productionLine || b.plannedStartDate !== a.plannedStartDate) {
        moved.push({
          packagingOrder: id,
          lineChange: b.productionLine !== a.productionLine
            ? `${b.productionLine} → ${a.productionLine}` : null,
          startChange: b.plannedStartDate !== a.plannedStartDate
            ? `${b.plannedStartDate} → ${a.plannedStartDate}` : null,
        });
      }

      if (a.rmslAtDelivery != null && b.rmslAtDelivery != null) {
        rmslChanges.push({
          packagingOrder: id,
          before: b.rmslAtDelivery,
          after: a.rmslAtDelivery,
          delta: Math.round((a.rmslAtDelivery - b.rmslAtDelivery) * 10) / 10,
        });
      }

      riskDelta.before += b.riskScore || 0;
      riskDelta.after += a.riskScore || 0;
    }

    const lateBefore = before.filter((o) => o.late).length;
    const lateAfter = after.filter((o) => o.late).length;
    const rmslViolBefore = before.filter((o) => o.rmslViolation).length;
    const rmslViolAfter = after.filter((o) => o.rmslViolation).length;

    const oeeImpact = this._metricDelta(before, after, 'expectedOee');
    const throughputImpact = this._metricDelta(before, after, 'expectedThroughput');
    const capacityImpact = {
      peakUtilizationBefore: this._peakUtil(before),
      peakUtilizationAfter: this._peakUtil(after),
    };
    const deliveryRisk = {
      before: before.filter((o) => o.late || (o.riskScore || 0) >= 30).length,
      after: after.filter((o) => o.late || (o.riskScore || 0) >= 30).length,
    };
    const complianceImpact = {
      before: before.filter((o) => o.allocationStatus !== 'VALID').length,
      after: after.filter((o) => o.allocationStatus !== 'VALID').length,
    };

    return {
      ordersMoved: moved.length,
      moved,
      rmslChanges,
      riskDelta: {
        before: riskDelta.before,
        after: riskDelta.after,
        improvement: riskDelta.before - riskDelta.after,
      },
      lateOrders: { before: lateBefore, after: lateAfter, delta: lateAfter - lateBefore },
      rmslViolations: { before: rmslViolBefore, after: rmslViolAfter, delta: rmslViolAfter - rmslViolBefore },
      oeeImpact,
      throughputImpact,
      capacityImpact,
      deliveryRisk: { ...deliveryRisk, delta: deliveryRisk.after - deliveryRisk.before },
      complianceImpact: { ...complianceImpact, delta: complianceImpact.after - complianceImpact.before },
      inventoryImpact: {
        batchesChanged: after.filter((a) => {
          const b = beforeMap[a.packagingOrder || a.packagingOrderId];
          return b && b.recommendedBatchId !== a.recommendedBatchId;
        }).length,
      },
      summary: this._summary({
        lateB: lateBefore, lateA: lateAfter,
        rmslB: rmslViolBefore, rmslA: rmslViolAfter,
        moved: moved.length, oeeImpact, deliveryRisk, complianceImpact,
      }),
    };
  }

  _metricDelta(before, after, field) {
    const valsB = before.map((o) => o[field]).filter((v) => v != null);
    const valsA = after.map((o) => o[field]).filter((v) => v != null);
    const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
    const b = Math.round(avg(valsB) * 10) / 10;
    const a = Math.round(avg(valsA) * 10) / 10;
    return { before: b, after: a, delta: Math.round((a - b) * 10) / 10 };
  }

  _peakUtil(orders) {
    const byLine = {};
    for (const o of orders) {
      byLine[o.productionLine] = (byLine[o.productionLine] || 0) + 1;
    }
    return Math.max(0, ...Object.values(byLine));
  }

  _summary({ lateB, lateA, rmslB, rmslA, moved, oeeImpact, deliveryRisk, complianceImpact }) {
    const parts = [];
    if (moved) parts.push(`${moved} order(s) rescheduled`);
    if (lateA < lateB) parts.push(`Late orders reduced by ${lateB - lateA}`);
    if (rmslA < rmslB) parts.push(`Shelf-Life violations reduced by ${rmslB - rmslA}`);
    if (rmslA > rmslB) parts.push(`Shelf-Life violations increased by ${rmslA - rmslB}`);
    if (oeeImpact?.delta) {
      parts.push(`Expected OEE ${oeeImpact.delta > 0 ? 'improved' : 'reduced'} by ${Math.abs(oeeImpact.delta)}%`);
    }
    if (deliveryRisk?.delta < 0) parts.push(`Delivery risk orders reduced by ${Math.abs(deliveryRisk.delta)}`);
    if (complianceImpact?.delta < 0) parts.push(`Compliance issues reduced by ${Math.abs(complianceImpact.delta)}`);
    return parts.join('. ') || 'No significant schedule impact';
  }
}

module.exports = { ScheduleImpactEngine };
