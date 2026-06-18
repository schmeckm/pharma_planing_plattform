const {
  remainingShelfLifeMonths,
  remainingShelfLifePercent,
  addDays,
} = require('../utils/dateUtils');

class RmslForecastEngine {
  /**
   * Triple-point RMSL: packaging start, packaging end, customer delivery.
   */
  calculateTriplePoint(batch, order, countryRule) {
    const threshold = countryRule?.rmslThresholdMonths || 12;
    const deliveryDate = order.requestedDeliveryDate
      || order.salesOrder?.requestedDeliveryDate;
    const packagingStart = order.plannedStartDate || order.releaseDate;
    const packagingEnd = order.plannedEndDate || packagingStart;

    const checkpoints = [
      {
        checkpoint: 'PACKAGING_START',
        date: packagingStart,
        label: 'RMSL at Packaging Start',
      },
      {
        checkpoint: 'PACKAGING_END',
        date: packagingEnd,
        label: 'RMSL at Packaging End',
      },
      {
        checkpoint: 'CUSTOMER_DELIVERY',
        date: deliveryDate,
        label: 'RMSL at Customer Delivery',
      },
    ].filter((c) => c.date);

    const points = checkpoints.map((cp) => {
      const months = remainingShelfLifeMonths(batch.expiryDate, cp.date);
      const percentOfShelfLife = remainingShelfLifePercent(
        batch.expiryDate, batch.productionDate, cp.date
      );
      const percentOfThreshold = threshold > 0
        ? Math.round((months / threshold) * 1000) / 10
        : 100;
      const passed = months >= threshold;
      return {
        ...cp,
        rmslMonths: months,
        percentOfShelfLife,
        percentOfThreshold,
        thresholdMonths: threshold,
        passed,
        status: passed ? 'OK' : 'BELOW_THRESHOLD',
      };
    });

    const warnings = [];
    const prodStart = points.find((p) => p.checkpoint === 'PACKAGING_START');
    const prodEnd = points.find((p) => p.checkpoint === 'PACKAGING_END');
    const delivery = points.find((p) => p.checkpoint === 'CUSTOMER_DELIVERY');

    if (prodStart && !prodStart.passed) {
      warnings.push({
        code: 'RMSL_BELOW_AT_PACKAGING_START',
        severity: 'HIGH',
        message: `RMSL ${prodStart.rmslMonths} mo at packaging start < threshold ${threshold} mo`,
      });
    }
    if (prodEnd && prodStart?.passed && !prodEnd.passed) {
      warnings.push({
        code: 'RMSL_DROPS_DURING_PRODUCTION',
        severity: 'HIGH',
        message: `RMSL drops below threshold during production (${prodStart.rmslMonths} → ${prodEnd.rmslMonths} mo)`,
      });
    }
    if (delivery && !delivery.passed) {
      warnings.push({
        code: 'RMSL_BELOW_AT_DELIVERY',
        severity: 'HIGH',
        message: `RMSL ${delivery.rmslMonths} mo at customer delivery < threshold ${threshold} mo — delivery date risk`,
      });
    }
    if (prodEnd && delivery && prodEnd.passed && delivery.percentOfThreshold < prodEnd.percentOfThreshold) {
      warnings.push({
        code: 'RMSL_EROSION_TO_DELIVERY',
        severity: 'MEDIUM',
        message: `RMSL margin erodes from ${prodEnd.percentOfThreshold}% to ${delivery.percentOfThreshold}% of threshold by delivery`,
      });
    }

    return {
      batchId: batch.batchId,
      packagingOrderId: order.packagingOrderId,
      thresholdMonths: threshold,
      checkpoints: points,
      warnings,
      overallPassed: points.every((p) => p.passed),
    };
  }

  /**
   * Forecast RMSL impact when shifting order by N days.
   */
  forecastShiftImpact(batch, order, countryRule, shiftDays) {
    const shiftedOrder = {
      ...order,
      plannedStartDate: addDays(order.plannedStartDate, shiftDays),
      plannedEndDate: addDays(order.plannedEndDate || order.plannedStartDate, shiftDays),
    };
    const baseline = this.calculateTriplePoint(batch, order, countryRule);
    const shifted = this.calculateTriplePoint(batch, shiftedOrder, countryRule);
    const deliveryBaseline = baseline.checkpoints.find((c) => c.checkpoint === 'CUSTOMER_DELIVERY');
    const deliveryShifted = shifted.checkpoints.find((c) => c.checkpoint === 'CUSTOMER_DELIVERY');

    return {
      shiftDays,
      baseline: baseline.checkpoints,
      shifted: shifted.checkpoints,
      rmslPercentChange: deliveryBaseline && deliveryShifted
        ? Math.round((deliveryShifted.percentOfThreshold - deliveryBaseline.percentOfThreshold) * 10) / 10
        : 0,
      warnings: shifted.warnings,
      overallPassed: shifted.overallPassed,
    };
  }

  assessPortfolio(orders, batches, rulesData) {
    const results = [];
    for (const order of orders.filter((o) => o.status === 'OPEN')) {
      const countryRule = (rulesData.countryRules || []).find(
        (r) => r.countryCode === order.destinationCountry
      );
      const materialBatches = batches.filter(
        (b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED'
      );
      let best = null;
      for (const batch of materialBatches) {
        const forecast = this.calculateTriplePoint(batch, order, countryRule);
        if (!best || forecast.checkpoints[0]?.rmslMonths > best.checkpoints[0]?.rmslMonths) {
          best = forecast;
        }
      }
      if (best) results.push({ order, forecast: best });
    }
    return results;
  }
}

module.exports = { RmslForecastEngine };
