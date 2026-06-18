import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

export const settingsApi = {
  getHorizons: () => client.get('/settings/horizons').then((r) => r.data),
};
