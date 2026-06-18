import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL?.replace('/v1', '') || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

function authHeaders() {
  const user = JSON.parse(localStorage.getItem('hap_user') || '{}');
  const locale = localStorage.getItem('hap_locale') || 'de';
  return {
    'X-User-Id': user.userId || 'USR-PLANNER01',
    'X-User-Role': user.role || 'PLANNER',
    'X-User-Name': user.displayName || 'Planner',
    'X-Locale': locale,
    'Accept-Language': locale,
  };
}

function v3Request(method, path, data, params) {
  return client({ method, url: `/v3${path}`, data, params, headers: authHeaders() })
    .then((r) => r.data)
    .catch((err) => {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 403) {
        throw new Error(msg || 'Keine Berechtigung — Rolle im Header auf Planner, QA oder Admin wechseln.');
      }
      throw new Error(msg);
    });
}

export const apiV3 = {
  twinSimulate: (horizon = 7) => v3Request('get', '/twin/simulate', null, { horizon }),
  predictions: (horizons) => v3Request('get', '/predictions', null, horizons ? { horizons: horizons.join(',') } : undefined),
  optimize: (objectives) => v3Request('post', '/optimize', objectives || {}),
  runAgents: (payload) => v3Request('post', '/agents/run', payload || { trigger: 'SCHEDULED_DAILY', horizonDays: 7 }),
  morningBriefing: (horizonDays = 7) => v3Request('get', '/agents/morning-briefing', null, { horizonDays }),
  copilotAsk: (payload) => v3Request('post', '/copilot/ask', payload),
  executiveDashboard: (horizon = 7) => v3Request('get', '/executive/dashboard', null, { horizon }),
  getRecommendations: (status) => v3Request('get', '/recommendations', null, status ? { status } : undefined),
  getAgentsStatus: () => v3Request('get', '/agents/status'),
  approveRecommendation: (id) => v3Request('post', `/recommendations/${id}/approve`, {}),
  dismissRecommendation: (id, reason) => v3Request('post', `/recommendations/${id}/dismiss`, { reason }),
  graphStats: () => v3Request('get', '/graph/stats'),
  autopilotStatus: () => v3Request('get', '/autopilot/status'),
  autopilotRuns: (limit = 20) => v3Request('get', '/autopilot/runs', null, { limit }),
  runAutopilot: (payload) => v3Request('post', '/autopilot/run', payload || { dryRun: true }),
  updateAutopilotPolicy: (policy) => v3Request('put', '/autopilot/policy', policy),
  llmStatus: () => v3Request('get', '/llm/status'),
  llmReindex: () => v3Request('post', '/llm/reindex', {}),
  mlPrognosis: (horizons = [7, 30, 90]) => v3Request('get', '/ml/prognosis', null, {
    horizons: horizons.join(','),
  }),
};
