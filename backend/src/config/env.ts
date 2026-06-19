import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

export type PersistenceProvider = 'json' | 'postgres';

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  persistenceProvider: PersistenceProvider;
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  };
}

function parsePersistenceProvider(value: string | undefined): PersistenceProvider {
  if (value === 'postgres') return 'postgres';
  return 'json';
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8000', 10),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.HAP_DATA_DIR || path.join(__dirname, '../../../data'),
  persistenceProvider: parsePersistenceProvider(
    process.env.PERSISTENCE_PROVIDER || process.env.HAP_DATA_PROVIDER,
  ),
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'hap_scheduling',
    user: process.env.PG_USER || 'hap',
    password: process.env.PG_PASSWORD || '',
    ssl: process.env.PG_SSL === 'true',
  },
};
