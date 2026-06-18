const { InMemoryEventBus } = require('./InMemoryEventBus');
const { KafkaEventBus } = require('./KafkaEventBus');

const TOPICS = {
  AGENT_RUN: 'hap.agents.run',
  RECOMMENDATION: 'hap.recommendations',
  ALLOCATION: 'hap.allocation',
  INVENTORY: 'hap.inventory',
  QA: 'hap.qa',
  SAP: 'hap.sap.events',
};

let bus = null;

function getEventBus() {
  if (bus) return bus;
  const mode = process.env.HAP_EVENT_BUS || 'memory';
  bus = mode === 'kafka' ? new KafkaEventBus() : new InMemoryEventBus();
  return bus;
}

function publishAgentRun(payload) {
  return getEventBus().publish(TOPICS.AGENT_RUN, {
    type: 'AGENT_RUN_COMPLETED',
    data: payload,
  });
}

function publishRecommendationChange(payload) {
  return getEventBus().publish(TOPICS.RECOMMENDATION, {
    type: 'RECOMMENDATION_STATUS_CHANGED',
    data: payload,
  });
}

module.exports = { getEventBus, publishAgentRun, publishRecommendationChange, TOPICS };
