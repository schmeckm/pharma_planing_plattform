const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function expandLocalhostVariants(origins) {
  const expanded = new Set(origins);
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      const port = url.port ? `:${url.port}` : '';
      if (url.hostname === 'localhost') {
        expanded.add(`${url.protocol}//127.0.0.1${port}`);
      } else if (url.hostname === '127.0.0.1') {
        expanded.add(`${url.protocol}//localhost${port}`);
      }
    } catch {
      // Ungültige Origin-Einträge ignorieren
    }
  }
  return [...expanded];
}

function configuredOrigins() {
  const raw = process.env.CORS_ORIGIN || '';
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    return DEFAULT_ORIGINS;
  }
  return expandLocalhostVariants(entries);
}

export function createCorsOriginChecker() {
  const allowed = new Set(configuredOrigins());

  return (origin, callback) => {
    if (!origin || allowed.has(origin)) {
      callback(null, origin || true);
      return;
    }
    callback(new Error(`CORS blockiert für Origin: ${origin}`));
  };
}

export function createCorsOptions() {
  return {
    origin: createCorsOriginChecker(),
    credentials: true,
  };
}

export function createSocketCorsOptions() {
  return {
    origin: configuredOrigins(),
    credentials: true,
  };
}
