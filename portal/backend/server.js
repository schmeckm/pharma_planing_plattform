import './instrument.js';
import { createServer } from 'http';
import app from './app.js';
import { validateEnv } from './config/validateEnv.js';
import { initDatabase } from './database/initDatabase.js';
import { runMigrations } from './database/migrate.js';
import { initSocket } from './services/socketService.js';
import { startScheduler } from './services/schedulerService.js';
import { bootstrapDefaultUsers } from './services/bootstrapService.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

validateEnv();

const server = createServer(app);
initSocket(server);

async function bootstrap() {
  await initDatabase();
  await runMigrations();
  await bootstrapDefaultUsers();
  startScheduler();

  server.listen(port, host, () => {
    console.log(JSON.stringify({ level: 'info', msg: 'server_started', port, host }));
  });
}

bootstrap().catch((err) => {
  console.error(JSON.stringify({ level: 'error', msg: 'bootstrap_failed', error: err.message }));
  process.exit(1);
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', msg: 'shutdown', signal }));
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
