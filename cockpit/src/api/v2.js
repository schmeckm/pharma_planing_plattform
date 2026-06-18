import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL?.replace('/v1', '') || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

function authHeaders() {
  const user = JSON.parse(localStorage.getItem('hap_user') || '{}');
  return {
    'X-User-Id': user.userId || 'USR-PLANNER01',
    'X-User-Role': user.role || 'PLANNER',
    'X-User-Name': user.displayName || 'Planner',
  };
}

function v2Request(method, path, data) {
  return client({ method, url: `/v2${path}`, data, headers: authHeaders() }).then((r) => r.data);
}

export const apiV2 = {
  login: (username) => v2Request('post', '/auth/login', { username }),
  me: () => v2Request('get', '/auth/me'),

  getUsers: () => v2Request('get', '/auth/users'),
  getFeatureCatalog: () => v2Request('get', '/auth/features'),
  getRoleDefaultFeatures: (role) => v2Request('get', `/auth/features/role-defaults/${role}`),
  updateUserFeatures: (userId, enabledFeatures) =>
    v2Request('put', `/auth/users/${userId}/features`, { enabledFeatures }),

  getRules: (params) => client.get('/v2/rules', { params, headers: authHeaders() }).then((r) => r.data),
  getRule: (ruleId) => client.get(`/v2/rules/${ruleId}`, { headers: authHeaders() }).then((r) => r.data),
  exportRules: () => client.get('/v2/rules/export', { headers: authHeaders() }).then((r) => r.data),
  getProvider: () => client.get('/v2/provider', { headers: authHeaders() }).then((r) => r.data),
  createRule: (payload) => v2Request('post', '/rules', payload),
  updateRule: (ruleId, payload) => v2Request('put', `/rules/${ruleId}`, payload),

  getExceptions: (params) => client.get('/v2/exceptions', { params, headers: authHeaders() }).then((r) => r.data),
  addComment: (id, text) => v2Request('post', `/exceptions/${id}/comments`, { text }),
  escalate: (id, payload) => v2Request('post', `/exceptions/${id}/escalate`, payload),
  resolve: (id, resolution) => v2Request('post', `/exceptions/${id}/resolve`, { resolution }),
  review: (id) => v2Request('post', `/exceptions/${id}/review`, {}),

  whatIfSimulate: (payload) => v2Request('post', '/what-if/simulate', payload),
  getWhatIfScenarios: () => v2Request('get', '/what-if/scenarios'),

  createMassJob: (payload) => v2Request('post', '/jobs/mass-allocation', payload),
  getJobs: () => v2Request('get', '/jobs'),
  getJob: (jobId) => v2Request('get', `/jobs/${jobId}`),
  cancelJob: (jobId) => v2Request('post', `/jobs/${jobId}/cancel`, {}),

  copilotAsk: (payload) => v2Request('post', '/copilot/ask', payload),
};
