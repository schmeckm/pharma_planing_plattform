import { Router } from 'express';
import { getDetailedHealth } from '../services/healthService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/detailed', async (_req, res) => {
  try {
    const payload = await getDetailedHealth();
    res.status(payload.status === 'ok' ? 200 : 503).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', services: [] });
  }
});

export default router;
