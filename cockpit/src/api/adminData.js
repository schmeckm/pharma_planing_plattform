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

export const adminDataApi = {
  listEntities: () => req('get', '/admin/data/entities'),

  list: (slug, params = {}) => req('get', `/admin/data/${slug}`, null, params),

  get: (slug, id) => req('get', `/admin/data/${slug}/${encodeURIComponent(id)}`),

  create: (slug, payload) => req('post', `/admin/data/${slug}`, payload),

  update: (slug, id, payload) => req('put', `/admin/data/${slug}/${encodeURIComponent(id)}`, payload),

  delete: (slug, id) => req('delete', `/admin/data/${slug}/${encodeURIComponent(id)}`),

  /** Direct REST aliases (e.g. /planning-orders) */
  rest: {
    list: (slug, params) => req('get', `/${slug}`, null, params),
    get: (slug, id) => req('get', `/${slug}/${encodeURIComponent(id)}`),
    create: (slug, payload) => req('post', `/${slug}`, payload),
    update: (slug, id, payload) => req('put', `/${slug}/${encodeURIComponent(id)}`, payload),
    delete: (slug, id) => req('delete', `/${slug}/${encodeURIComponent(id)}`),
  },
};
