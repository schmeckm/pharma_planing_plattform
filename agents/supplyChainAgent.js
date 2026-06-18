const { BaseAgent } = require('./baseAgent');

class SupplyChainAgent extends BaseAgent {
  constructor(tools) {
    super('supply-chain-agent', tools);
  }

  async run(context) {
    const { twinProjection, batches, orders, forecasts = [], horizonDays = 7, t = (key, params) => key } = context;
    const recommendations = [];

    const markets = twinProjection?.projections?.atRiskMarkets || [];
    const surplus = batches.filter((b) => b.availableQuantity > 5000 && b.qualityStatus === 'RELEASED');
    const deficitMarkets = markets.filter((m) => m.riskLevel === 'HIGH' || m.riskLevel === 'MEDIUM');

    for (const market of deficitMarkets) {
      const surplusBatch = surplus.find(
        (b) => b.approvedCountries?.includes(market.countryCode),
      ) || surplus[0];

      if (surplusBatch) {
        recommendations.push(
          this.createRecommendation({
            type: 'INVENTORY_REBALANCE',
            targetId: market.countryCode,
            action: t('supplyChain.evaluateTransfer', {
              country: market.countryCode,
              count: market.orderCount,
            }),
            rationale: t('supplyChain.marketRisk', {
              country: market.countryCode,
              riskLevel: market.riskLevel,
              horizon: horizonDays,
            }),
            impact: t('supplyChain.impactAtp', { orderCount: market.orderCount }),
            confidence: 0.75,
            evidence: [`twin:market:${market.countryCode}`, surplusBatch.batchId],
            approverRole: 'SUPPLY_CHAIN',
          }),
        );
      }
    }

    const jpForecast = forecasts.find((f) => f.marketId === 'MKT-JP' || f.marketId?.includes('JP'));
    const jpInventory = batches
      .filter((b) => b.approvedCountries?.includes('JP'))
      .reduce((s, b) => s + b.availableQuantity, 0);
    const chSurplus = batches.find((b) => b.approvedCountries?.includes('CH') && b.availableQuantity >= 10000);

    if (jpForecast && jpInventory < jpForecast.forecastQuantity * 0.5 && chSurplus) {
      const transferQty = Math.min(10000, chSurplus.availableQuantity);
      recommendations.push(
        this.createRecommendation({
          type: 'MARKET_TRANSFER',
          targetId: 'JP',
          action: t('supplyChain.transferUnits', { qty: transferQty.toLocaleString() }),
          rationale: t('supplyChain.jpShortage', {
            forecast: jpForecast.forecastQuantity,
            available: jpInventory,
          }),
          impact: t('supplyChain.impactJp'),
          confidence: 0.78,
          evidence: [jpForecast.forecastId, chSurplus.batchId, 'forecast:JP-14d'],
          approverRole: 'SUPPLY_CHAIN',
        }),
      );
    }

    const expiring = batches.filter((b) => (b.remainingShelfLifeMonths || 99) < 3);
    for (const batch of expiring.slice(0, 2)) {
      const affected = orders.filter((o) => o.materialNumber === batch.materialNumber && o.status === 'OPEN');
      recommendations.push(
        this.createRecommendation({
          type: 'EXPIRY_RISK',
          targetId: batch.batchId,
          packagingOrderId: affected[0]?.packagingOrderId,
          action: t('supplyChain.prioritizeBatch', {
            batchId: batch.batchId,
            months: batch.remainingShelfLifeMonths,
          }),
          rationale: t('supplyChain.expiryRisk'),
          impact: affected[0]
            ? t('supplyChain.impactOrder', { orderId: affected[0].packagingOrderId })
            : t('supplyChain.impactExposure'),
          confidence: 0.8,
          evidence: [batch.batchId, 'predictive:expiry'],
          approverRole: 'SUPPLY_CHAIN',
        }),
      );
    }

    return { agentId: this.name, recommendations, count: recommendations.length };
  }
}

module.exports = { SupplyChainAgent };
