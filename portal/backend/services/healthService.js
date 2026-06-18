import { sequelize } from '../database/initDatabase.js';
import { isGoogleConfigured } from './oauthService.js';

const VERSION = '0.1.0';

async function pingUrl(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    const latencyMs = Date.now() - start;
    return { ok: res.ok, latencyMs };
  } catch {
    return { ok: false, latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

function serviceStatus(ok, activeLabel = 'online', inactiveLabel = 'offline') {
  return ok ? activeLabel : inactiveLabel;
}

export async function getDetailedHealth() {
  const services = [];

  services.push({
    id: 'backend',
    label: 'Backend',
    status: 'online',
    latencyMs: 0,
  });

  services.push({
    id: 'frontend',
    label: 'Frontend',
    status: 'online',
  });

  let databaseOk = false;
  try {
    await sequelize.authenticate();
    databaseOk = true;
  } catch {
    databaseOk = false;
  }
  services.push({
    id: 'database',
    label: 'Datenbank',
    status: serviceStatus(databaseOk),
  });

  const allocationBase = (process.env.ALLOCATION_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const allocationPing = await pingUrl(`${allocationBase}/health`);
  services.push({
    id: 'allocationApi',
    label: 'Allocation API',
    status: serviceStatus(allocationPing.ok),
    latencyMs: allocationPing.latencyMs,
  });

  const llmConfigured = Boolean(process.env.OPENAI_API_KEY);
  services.push({
    id: 'llm',
    label: 'LLM',
    status: llmConfigured ? 'aktiv' : 'inaktiv',
  });

  services.push({
    id: 'googleSso',
    label: 'Google SSO',
    status: isGoogleConfigured() ? 'konfiguriert' : 'nicht konfiguriert',
  });

  const emailConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  services.push({
    id: 'email',
    label: 'E-Mail',
    status: emailConfigured ? 'konfiguriert' : 'nicht konfiguriert',
  });

  const overallOk = databaseOk;
  return {
    status: overallOk ? 'ok' : 'degraded',
    version: VERSION,
    services,
    checkedAt: new Date().toISOString(),
  };
}
