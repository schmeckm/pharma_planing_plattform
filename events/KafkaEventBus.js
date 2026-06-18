/**
 * Kafka Event Bus — production adapter (mock for MVP 3.0).
 * Set KAFKA_BROKERS=localhost:9092 for real connection in MVP 4.
 */
const { InMemoryEventBus } = require('./InMemoryEventBus');

class KafkaEventBus {
  constructor(config = {}) {
    this.brokers = config.brokers || process.env.KAFKA_BROKERS;
    this._mock = new InMemoryEventBus();
    this.connected = !this.brokers;
  }

  async connect() {
    if (!this.brokers) {
      console.log('[KafkaEventBus] Mock mode — no brokers configured');
      this.connected = true;
      return { connected: true, mode: 'mock' };
    }
    // Production: kafkajs connect
    this.connected = true;
    return { connected: true, brokers: this.brokers };
  }

  publish(topic, event) {
    console.log(`[Kafka Mock] Publish ${topic}:`, event.type);
    return this._mock.publish(topic, event);
  }

  subscribe(topic, handler) {
    return this._mock.subscribe(topic, handler);
  }

  getLog(limit = 100) {
    return this._mock.getLog(limit);
  }
}

module.exports = { KafkaEventBus };
