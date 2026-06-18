const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const apiRoutes = require('./routes');
const apiV2Routes = require('./routes/v2');
const apiV3Routes = require('./routes/v3');
const apiV4Routes = require('./routes/v4');
const apiV5Routes = require('./routes/v5');
const { AppError } = require('./utils/errors');
const { WsHub } = require('./websocket/wsHub');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const API_PREFIX = '/api/v1';
const API_V2_PREFIX = '/api/v2';
const API_V3_PREFIX = '/api/v3';
const API_V4_PREFIX = '/api/v4/control-tower';
const API_V5_PREFIX = '/api/v5/planning';

app.use(cors());
app.use(express.json());

const swaggerDocument = YAML.load(path.join(__dirname, 'swagger', 'openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/openapi.yaml', (_req, res) => {
  res.sendFile(path.join(__dirname, 'swagger', 'openapi.yaml'));
});

app.get('/health', async (_req, res) => {
  let llm = { configured: false };
  try {
    llm = require('./services/llm/llmClient').getLlmStatus();
  } catch { /* optional */ }
  let scheduling = { mode: process.env.SCHEDULING_OPTIMIZER || 'heuristic' };
  try {
    const { SchedulingService } = require('./services/schedulingService');
    scheduling = await new SchedulingService().getOptimizerStatus();
  } catch (err) {
    scheduling.error = err.message;
  }
  res.json({
    status: 'healthy',
    version: '2.0.0-enterprise',
    runtime: 'node',
    edition: 'Pharmaceutical Allocation & Production Sequencing Platform',
    editions: ['1.0', '2.0', '3.0', '4.0', '5.0'],
    dataProvider: process.env.HAP_DATA_PROVIDER || 'json',
    liveCache: (() => {
      try {
        const { JsonRepository } = require('./utils/jsonRepository');
        return new JsonRepository().getCacheStats();
      } catch {
        return { enabled: false };
      }
    })(),
    scheduling,
    llm,
  });
});

app.get(['/', '/api'], (_req, res) => {
  res.json({
    name: 'Hard Allocation Platform API',
    docs: '/docs',
    health: '/health',
    apis: {
      v1: `${API_PREFIX}`,
      v2: `${API_V2_PREFIX}`,
      v3: `${API_V3_PREFIX}`,
      v4: `${API_V4_PREFIX}`,
      v5: `${API_V5_PREFIX}`,
    },
    hint: 'Use a versioned prefix, e.g. GET /api/v1/orders or GET /api/v2/rules',
  });
});

app.use(API_PREFIX, apiRoutes);
app.use(API_V2_PREFIX, apiV2Routes);
app.use(API_V3_PREFIX, apiV3Routes);
app.use(API_V4_PREFIX, apiV4Routes);
app.use(API_V5_PREFIX, apiV5Routes);

app.use((_req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    path: _req.method + ' ' + _req.originalUrl,
    hint: 'All routes require a version prefix. Examples: /api/v1/orders, /api/v2/rules, /docs',
  });
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'INVALID_JSON', message: 'Malformed JSON request body' });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
});

const wsHub = new WsHub(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use — stop other backends: .\\scripts\\start.ps1 stop`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`Hard Allocation Platform running on http://127.0.0.1:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
  console.log(`API base: http://localhost:${PORT}${API_PREFIX}`);
  console.log(`Control Tower: http://localhost:${PORT}${API_V4_PREFIX}`);
  console.log(`Planning API: http://localhost:${PORT}${API_V5_PREFIX}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws/control-tower`);

  try {
    const { warmupLiveCache } = require('./utils/jsonRepository');
    const warm = warmupLiveCache();
    if (warm.loaded?.length) {
      console.log(`[LiveCache] Warmed ${warm.loaded.length} collections (${warm.totalEntries} in RAM)`);
    }
  } catch (err) {
    console.warn('[LiveCache] warmup skipped:', err.message);
  }
});

module.exports = app;
