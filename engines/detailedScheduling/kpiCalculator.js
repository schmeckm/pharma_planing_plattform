class KpiCalculator {
  calculate(scheduleResult) {
    const { scheduledOrders = [], blockedOrders = [], exceptions = [], utilization = [] } = scheduleResult;
    const total = scheduledOrders.length + blockedOrders.length;
    const onTime = scheduledOrders.filter(
      (o) => !o.dueDate || o.scheduledEndDate <= o.dueDate,
    ).length;
    const totalSetup = scheduledOrders.reduce((s, o) => s + (o.setupHours || 0), 0);
    const campaigns = new Set(scheduledOrders.map((o) => o.campaignGroup)).size;
    const campaignGroups = {};
    for (const o of scheduledOrders) {
      campaignGroups[o.campaignGroup] = (campaignGroups[o.campaignGroup] || 0) + 1;
    }
    const maxCampaign = Math.max(...Object.values(campaignGroups), 0);
    const campaignEfficiency = scheduledOrders.length
      ? Math.round((maxCampaign / scheduledOrders.length) * 1000) / 10
      : 0;

    const avgUtil = utilization.length
      ? Math.round(utilization.reduce((s, u) => s + u.avgUtilizationPercent, 0) / utilization.length * 10) / 10
      : 0;

    return {
      scheduleAdherence: total ? Math.round((onTime / total) * 1000) / 10 : 0,
      otif: total ? Math.round((onTime / total) * 1000) / 10 : 0,
      capacityUtilization: avgUtil,
      totalSetupHours: Math.round(totalSetup * 10) / 10,
      oeeImpact: avgUtil,
      campaignEfficiency,
      inventoryUsage: scheduledOrders.filter((o) => o.recommendedBatch).length,
      blockedOrders: blockedOrders.length,
      scheduledOrders: scheduledOrders.length,
      exceptionCount: exceptions.length,
    };
  }
}

module.exports = { KpiCalculator };
