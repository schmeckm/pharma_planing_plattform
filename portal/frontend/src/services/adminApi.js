import api from './api';

export const adminApi = {
  getUsers() {
    return api.get('/api/admin/users');
  },
  createUser(payload) {
    return api.post('/api/admin/users', payload);
  },
  updateUser(id, payload) {
    return api.patch(`/api/admin/users/${id}`, payload);
  },
  deleteUser(id) {
    return api.delete(`/api/admin/users/${id}`);
  },
  getAuditActions() {
    return api.get('/api/admin/audit/actions');
  },
  getAudit(params) {
    return api.get('/api/admin/audit', { params });
  },
  getSystem() {
    return api.get('/api/admin/system');
  },
  updateSettings(settings) {
    return api.patch('/api/admin/system/settings', settings);
  },
  getEmailStatus() {
    return api.get('/api/admin/email');
  },
  sendTestEmail(to) {
    return api.post('/api/admin/email/test', { to });
  },
};
