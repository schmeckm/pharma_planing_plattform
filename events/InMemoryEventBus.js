const { IEventBus } = require('./IEventBus');

class InMemoryEventBus extends IEventBus {
  constructor() {
    super();
    this.handlers = new Map();
    this.log = [];
  }

  publish(topic, event) {
    const entry = {
      id: event.id || `evt-${Date.now()}`,
      topic,
      time: new Date().toISOString(),
      type: event.type,
      data: event.data,
    };
    this.log.push(entry);

    const handlers = this.handlers.get(topic) || [];
    handlers.forEach((h) => {
      try { h(entry); } catch (e) { console.error(`[EventBus] Handler error on ${topic}:`, e.message); }
    });
    return entry;
  }

  subscribe(topic, handler) {
    if (!this.handlers.has(topic)) this.handlers.set(topic, []);
    this.handlers.get(topic).push(handler);
  }

  getLog(limit = 100) {
    return this.log.slice(-limit);
  }
}

module.exports = { InMemoryEventBus };
