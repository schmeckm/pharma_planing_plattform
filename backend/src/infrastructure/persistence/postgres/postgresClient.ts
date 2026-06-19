import { PersistenceError } from '../../../common/errors';
import { config } from '../../../config/env';

export interface PostgresClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

let clientInstance: PostgresClient | null = null;

export async function getPostgresClient(): Promise<PostgresClient> {
  if (config.persistenceProvider !== 'postgres') {
    throw new PersistenceError('PostgreSQL client requested but PERSISTENCE_PROVIDER is not postgres');
  }
  if (!clientInstance) {
    throw new PersistenceError(
      'PostgreSQL persistence is not yet implemented. Set PERSISTENCE_PROVIDER=json for the MVP.',
    );
  }
  return clientInstance;
}

export async function closePostgresClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
  }
}

/** Future: initialize pg.Pool from config.postgres */
export function initPostgresClient(): void {
  // Phase 2 — wire pg.Pool here when PostgreSQL is enabled.
}
