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

function req(method, path, data, params) {
  return client({ method, url: `/v5/planning${path}`, data, params, headers: authHeaders() }).then((r) => r.data);
}

export const apiV5 = {
  dashboard: (lineId, horizon) => req('get', '/dashboard', null, { lineId, horizon }),
  timeline: (lineId) => req('get', '/timeline', null, { lineId }),
  gantt: (lineId) => req('get', '/gantt', null, { lineId: lineId || 'PACK_LINE_01' }),
  capacity: (horizon) => req('get', '/capacity', null, { horizon }),
  rmslRisk: () => req('get', '/rmsl-risk'),
  marketDelivery: () => req('get', '/market-delivery'),
  sequencing: (lineId) => req('get', '/sequencing', null, { lineId: lineId || 'PACK_LINE_01' }),
  twin: (horizon) => req('get', '/twin', null, { horizon }),
  whatIf: (payload) => req('post', '/what-if', payload),
  orderRmsl: (id, batchId) => req('get', `/orders/${id}/rmsl`, null, batchId ? { batchId } : undefined),
};
