import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
});

function authHeaders() {
  const user = JSON.parse(localStorage.getItem('hap_user') || '{}');
  return {
    'X-User-Id': user.userId || 'USR-PLANNER01',
    'X-User-Role': user.role || 'PLANNER',
    'X-User-Name': user.displayName || 'Planner',
  };
}

function req(method, path, data) {
  return client({ method, url: path, data, headers: authHeaders() }).then((r) => r.data);
}

export const detailedSchedulingApi = {
  getMasterData: () => req('get', '/planning/detailed-scheduling/master-data'),
  getDashboard: () => req('get', '/planning/detailed-scheduling/dashboard'),
  buildSchedule: (payload = {}) => req('post', '/planning/detailed-scheduling/build', payload),
  getSchedule: () => req('get', '/planning/detailed-scheduling/schedule'),
  runWhatIf: (scenario) => req('post', '/planning/detailed-scheduling/what-if', scenario),
  rescheduleOrder: (override) => req('post', '/planning/detailed-scheduling/reschedule', override),
  confirmSchedule: (payload = {}) => req('post', '/planning/detailed-scheduling/confirm', payload),
  explainOrder: (orderNumber) => req('get', `/planning/detailed-scheduling/explain/order/${orderNumber}`),
  explainSchedule: () => req('get', '/planning/detailed-scheduling/explain/schedule'),
  getIntegrationCatalog: () => req('get', '/planning/detailed-scheduling/integration'),
};

export function connectSchedulingWs(onMessage) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  let wsUrl;
  if (apiBase.startsWith('http')) {
    const u = new URL(apiBase);
    wsUrl = `${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}/ws/detailed-scheduling`;
  } else {
    wsUrl = `${proto}//${host}/ws/detailed-scheduling`;
  }
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch { /* ignore */ }
  };
  return ws;
}
