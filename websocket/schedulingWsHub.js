const { WebSocketServer } = require('ws');

class SchedulingWsHub {
  constructor(server) {
    this.clients = new Set();
    this.wss = new WebSocketServer({ server, path: '/ws/detailed-scheduling' });
    this.wss.on('connection', (ws) => this._onConnect(ws));
  }

  _onConnect(ws) {
    this.clients.add(ws);
    ws.send(JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() }));
    ws.on('close', () => this.clients.delete(ws));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
      } catch { /* ignore */ }
    });
  }

  broadcast(event) {
    const payload = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  close() {
    this.wss.close();
  }
}

module.exports = { SchedulingWsHub };
