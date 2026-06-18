class IEventBus {
  publish(topic, event) { throw new Error('Not implemented'); }
  subscribe(topic, handler) { throw new Error('Not implemented'); }
}

module.exports = { IEventBus };
