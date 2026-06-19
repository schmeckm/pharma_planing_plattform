import { createApp, config } from './app';

const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`HAP Backend (layered) running on http://${config.host}:${config.port}`);
  console.log(`Persistence provider: ${config.persistenceProvider}`);
  console.log(`Data directory: ${config.dataDir}`);
});
