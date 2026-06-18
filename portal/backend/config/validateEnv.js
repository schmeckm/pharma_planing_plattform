const errors = [];

export function validateEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }

  if (process.env.DATABASE_DIALECT === 'sqlite') {
    errors.push('SQLite must not be used in production');
  }

  if (!process.env.CORS_ORIGIN) {
    errors.push('CORS_ORIGIN must be set in production');
  }

  if (errors.length) {
    throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  }
}
