import './config/loadEnv.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCorsOptions } from './config/corsOptions.js';
import { Sentry } from './instrument.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { requestLogger } from './middleware/requestLogger.js';
import { localeMiddleware } from './middleware/localeMiddleware.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { mountApiRoutes } from './utils/mountApiRoutes.js';
import { sendError } from './utils/apiResponse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl?.includes('/billing/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use(requestIdMiddleware);
app.use(metricsMiddleware);
app.use(requestLogger);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', localeMiddleware, apiLimiter);
app.use('/api/v1', localeMiddleware, apiLimiter);
mountApiRoutes(app);

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }
  sendError(res, req, status, err.messageKey || 'errors.internal');
});

export default app;
