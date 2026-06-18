import client from './client';

function authHeaders() {
  const user = JSON.parse(localStorage.getItem('hap_user') || '{}');
  return {
    'X-User-Id': user.userId || 'USR-PLANNER01',
    'X-User-Role': user.role || 'PLANNER',
    'X-User-Name': user.displayName || 'Planner',
  };
}

export async function fetchLineFactors() {
  const { data } = await client.get('/performance/line-factors', { headers: authHeaders() });
  return data;
}

export async function updateLineFactor(lineId, payload) {
  const { data } = await client.put(`/performance/line-factors/${lineId}`, payload, {
    headers: authHeaders(),
  });
  return data;
}

export async function fetchHistoricalAnalysis() {
  const { data } = await client.get('/performance/historical-analysis', { headers: authHeaders() });
  return data;
}

export async function fetchShiftHistory(windowDays = 365) {
  const { data } = await client.get('/performance/shift-history', {
    headers: authHeaders(),
    params: { windowDays, limit: 100 },
  });
  return data;
}

export async function applyDerivedFactors(horizon = 'long') {
  const { data } = await client.post('/performance/apply-derived-factors', { horizon }, {
    headers: authHeaders(),
  });
  return data;
}
