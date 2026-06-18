import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
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

function req(method, path, data) {
  return client({ method, url: path, data, headers: authHeaders() }).then((r) => r.data);
}

export const lineOptimizationApi = {
  getOrders: () => req('get', '/line-optimization/orders'),
  getLines: () => req('get', '/line-optimization/lines'),
  simulate: (sequence) => req('post', '/line-optimization/simulate', { sequence }),
  optimize: (params) => req('post', '/line-optimization/optimize', params || {}),
  saveSequence: (payload) => req('post', '/line-optimization/save-sequence', payload),
};
