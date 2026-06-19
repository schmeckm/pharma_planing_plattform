import express from 'express';
import cors from 'cors';
import { createApiRouter } from './routes';
import { errorHandler } from './common/middleware/errorHandler';
import { config } from './config/env';

export function createApp(): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/v1', createApiRouter());
  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Backend route not found' });
  });
  app.use(errorHandler);
  return app;
}

export { config };
