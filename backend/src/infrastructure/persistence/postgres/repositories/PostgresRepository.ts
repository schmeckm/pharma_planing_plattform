import type { BaseEntity, Repository } from '../../../../domain/base/types';
import { PersistenceError } from '../../../../common/errors';

/**
 * Base class for future PostgreSQL repository implementations.
 * Throws until Phase 2 migration is complete.
 */
export abstract class PostgresRepository<T extends BaseEntity> implements Repository<T> {
  protected constructor(protected readonly tableName: string) {}

  private notImplemented(): never {
    throw new PersistenceError(
      `PostgreSQL repository for '${this.tableName}' is not yet implemented. Use PERSISTENCE_PROVIDER=json.`,
    );
  }

  async findAll(): Promise<T[]> {
    return this.notImplemented();
  }

  async findById(_id: string): Promise<T | null> {
    return this.notImplemented();
  }

  async create(_entity: Partial<T> & Record<string, unknown>): Promise<T> {
    return this.notImplemented();
  }

  async update(_id: string, _entity: Partial<T>): Promise<T> {
    return this.notImplemented();
  }

  async delete(_id: string): Promise<void> {
    this.notImplemented();
  }
}
