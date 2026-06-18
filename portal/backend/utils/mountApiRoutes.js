import { Router } from 'express';
import authRoutes from '../routes/authRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/admin', adminRoutes);

export function mountApiRoutes(app) {
  app.use('/api', apiRouter);
  app.use('/api/v1', apiRouter);
}

export default apiRouter;
