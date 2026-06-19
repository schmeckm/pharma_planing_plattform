import { Router } from 'express';
import { createAdminDataRouter } from './routes/index';
import { registerEntityAliasRoutes } from './routes/entityAliases';

export function registerBackendRoutes(apiRouter: Router): void {
  apiRouter.use('/admin/data', createAdminDataRouter());
  registerEntityAliasRoutes(apiRouter);
}
