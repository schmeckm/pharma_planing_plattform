import { Router } from 'express';
import {
  listEntitiesMeta,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from './adminDataController';

export function createAdminDataRouter(): Router {
  const router = Router();

  router.get('/entities', listEntitiesMeta);
  router.get('/:slug', listRecords);
  router.get('/:slug/:id', getRecord);
  router.post('/:slug', createRecord);
  router.put('/:slug/:id', updateRecord);
  router.delete('/:slug/:id', deleteRecord);

  return router;
}

export function createApiRouter(): Router {
  const router = Router();
  router.use('/admin/data', createAdminDataRouter());
  router.get('/health/backend', (_req, res) => {
    res.json({
      status: 'healthy',
      architecture: 'layered',
      persistenceProvider: process.env.PERSISTENCE_PROVIDER || 'json',
      layers: ['controller', 'service', 'repository'],
    });
  });
  return router;
}
