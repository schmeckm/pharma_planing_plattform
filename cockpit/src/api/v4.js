import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL?.replace('/v1', '') || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

function authHeaders() {
  const user = JSON.parse(localStorage.getItem('hap_user') || '{}');
  return {
    'X-User-Id': user.userId || 'USR-PLANNER01',
    'X-User-Role': user.role || 'PLANNER',
    'X-User-Name': user.displayName || 'Planner',
  };
}

function v4Request(method, path, params) {
  return client({ method, url: `/v4/control-tower${path}`, params, headers: authHeaders() }).then((r) => r.data);
}

export const apiV4 = {
  dashboard: (horizon = 7) => v4Request('get', '/dashboard', { horizon }),
  inventory: () => v4Request('get', '/inventory'),
  demand: () => v4Request('get', '/demand'),
  allocation: () => v4Request('get', '/allocation'),
  risk: (horizon = 30) => v4Request('get', '/risk', { horizon }),
  executive: (horizon = 7) => v4Request('get', '/executive', { horizon }),
  events: (limit = 50) => v4Request('get', '/events', { limit }),
  twin: (horizon = 7) => v4Request('get', '/twin', { horizon }),
  recommendations: () => v4Request('get', '/recommendations'),
  planningImpact: (params = {}) => v4Request('get', '/planning-impact', params),
  planStability: (params = {}) => v4Request('get', '/plan-stability', params),
};

export function connectControlTowerWs(onMessage) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  const ws = new WebSocket(`${proto}://${host}/ws/control-tower`);
  ws.onmessage = (evt) => {
    try { onMessage(JSON.parse(evt.data)); } catch { /* ignore */ }
  };
  return ws;
}
