const { WebSocketServer } = require('ws');
const { ControlTowerService } = require('../services/controlTowerService');

class WsHub {
  constructor(server) {
    this.clients = new Set();
    this.service = new ControlTowerService();
    this.wss = new WebSocketServer({ server, path: '/ws/control-tower' });
    this.wss.on('connection', (ws) => this._onConnect(ws));
    this._interval = setInterval(() => this._broadcastSnapshot(), 15000);
  }

  _onConnect(ws) {
    this.clients.add(ws);
    ws.send(JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() }));
    ws.send(JSON.stringify({ type: 'SNAPSHOT', payload: this._buildSnapshot() }));
    ws.on('close', () => this.clients.delete(ws));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
        if (msg.type === 'SUBSCRIBE') ws.send(JSON.stringify({ type: 'SNAPSHOT', payload: this._buildSnapshot() }));
      } catch { /* ignore */ }
    });
  }

  _buildSnapshot() {
    return {
      executive: this.service.getExecutiveDashboard(7).kpis,
      events: this.service.getEvents(5).items,
      allocation: this.service.getAllocationMonitor().summary,
    };
  }

  _broadcastSnapshot() {
    if (!this.clients.size) return;
    const payload = JSON.stringify({ type: 'UPDATE', payload: this._buildSnapshot(), timestamp: new Date().toISOString() });
    for (const ws of this.clients) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  broadcastEvent(event) {
    const payload = JSON.stringify({ type: 'EVENT', payload: event, timestamp: new Date().toISOString() });
    for (const ws of this.clients) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  close() {
    clearInterval(this._interval);
    this.wss.close();
  }
}

module.exports = { WsHub };
