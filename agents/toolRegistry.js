/**
 * MCP-style tools exposed to LLM agents.
 * Tools wrap existing services — LLM never invents batch/order IDs.
 */
function createToolRegistry(services) {
  const { simulateTwin, getPredictions, getOrders, getBatches, getExceptions } = services;

  return {
    get_twin_projection: {
      description: 'Digital Supply Chain Twin T+N allocation projection',
      parameters: { horizonDays: 'number' },
      execute: async ({ horizonDays = 7 }) => simulateTwin(horizonDays),
    },
    get_predictions: {
      description: 'Predictive RMSL, expiry and bottleneck forecasts',
      parameters: { horizons: 'number[]' },
      execute: async ({ horizons = [7, 30, 90] }) => getPredictions(horizons),
    },
    list_open_orders: {
      description: 'Open packaging orders',
      parameters: {},
      execute: async () => getOrders().filter((o) => o.status === 'OPEN' || o.status === 'PLANNED'),
    },
    list_batches: {
      description: 'Released batches with shelf-life',
      parameters: { materialNumber: 'string?' },
      execute: async ({ materialNumber }) => {
        let batches = getBatches().filter((b) => b.qualityStatus === 'RELEASED');
        if (materialNumber) batches = batches.filter((b) => b.materialNumber === materialNumber);
        return batches.slice(0, 50);
      },
    },
    list_exceptions: {
      description: 'Open planning exceptions',
      parameters: {},
      execute: async () => getExceptions().filter((e) => e.status === 'OPEN').slice(0, 30),
    },
  };
}

function summarizeToolsForPrompt(tools) {
  return Object.entries(tools)
    .map(([name, t]) => `- ${name}: ${t.description}`)
    .join('\n');
}

module.exports = { createToolRegistry, summarizeToolsForPrompt };
