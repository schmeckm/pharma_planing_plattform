import { Settings } from '../models/index.js';

const DEFAULTS = {
  'system.maintenanceMode': false,
  'system.registrationEnabled': true,
  'email.digestEnabled': true,
  'email.remindersEnabled': true,
};

export async function getSettings(keys = Object.keys(DEFAULTS)) {
  const entries = await Settings.findAll({
    where: { key: keys },
  });

  const map = { ...DEFAULTS };
  for (const entry of entries) {
    map[entry.key] = entry.value;
  }
  return map;
}

export async function setSettings(patch) {
  const updated = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS)) continue;
    const [row] = await Settings.findOrCreate({
      where: { key },
      defaults: { value },
    });
    if (row.value !== value) {
      await row.update({ value });
    }
    updated[key] = value;
  }
  return updated;
}

export async function getSystemInfo() {
  const settings = await getSettings();
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    version: '0.1.0',
    uptimeSeconds: Math.floor(process.uptime()),
    settings,
    features: {
      googleSso: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      saas: process.env.SAAS_ENABLED === 'true',
      sentry: Boolean(process.env.SENTRY_DSN),
      redis: Boolean(process.env.REDIS_URL),
      llm: Boolean(process.env.OPENAI_API_KEY),
    },
  };
}
