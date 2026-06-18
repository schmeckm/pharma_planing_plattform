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

function req(method, path, data, params) {
  return client({ method, url: path, data, params, headers: authHeaders() }).then((r) => r.data);
}

export const planningApi = {
  getPlannerDashboard: (options = {}) => {
    const opts = typeof options === 'string' ? { date: options } : options;
    return req('get', '/planning/planner-dashboard', null, {
      ...(opts.date ? { date: opts.date } : {}),
      ...(opts.startAnchor ? { startAnchor: opts.startAnchor } : {}),
      ...(opts.horizonDays != null ? { horizonDays: opts.horizonDays } : {}),
    });
  },
  getDailyOrders: (date) => req('get', '/planning/daily-orders', null, date ? { date } : undefined),
  getRecommendedSequence: (options = {}) =>
    req('get', '/planning/recommended-sequence', null, {
      ...(options.startAnchor ? { startAnchor: options.startAnchor } : {}),
      ...(options.horizonDays != null ? { horizonDays: options.horizonDays } : {}),
      ...(options.refresh ? { refresh: 'true' } : {}),
    }),
  optimizeSequence: (options = {}) =>
    client({
      method: 'post',
      url: '/planning/optimize-sequence',
      data: {
        ...(options.startAnchor ? { startAnchor: options.startAnchor } : {}),
        ...(options.horizonDays != null ? { horizonDays: options.horizonDays } : {}),
      },
      headers: authHeaders(),
      timeout: 120000,
    }).then((r) => r.data),
  whatIf: (sequence, compareToBaseline = true, options = {}) =>
    req('post', '/planning/what-if', {
      sequence,
      compareToBaseline,
      ...(options.horizonDays != null ? { horizonDays: options.horizonDays } : {}),
    }),
  confirmSequence: (payload) => req('post', '/planning/confirm-sequence', payload),
  activateDraft: (payload) => req('post', '/scheduler/activate-draft', payload),
  getDraftStatus: () => req('get', '/scheduler/draft/latest'),
  simulateBatchAssignment: (payload) => req('post', '/planning/simulate-batch-assignment', payload),
  getExceptions: (params) => req('get', '/planning/exceptions', null, params),
  getConfirmedSchedule: () => req('get', '/planning/confirmed-schedule'),
  combinedCalculation: (payload) => req('post', '/planning/combined-calculation', payload),
  getSchedulingStatus: () => req('get', '/planning/scheduling-status'),
  getSapOperationsStatus: () => req('get', '/planning/sap-operations'),
  syncSapOperations: () => req('post', '/planning/sap-operations/sync'),
};
