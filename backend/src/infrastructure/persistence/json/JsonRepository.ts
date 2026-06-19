import type { BaseEntity } from '../../../domain/base/types';
import { buildCompositeId } from '../../../domain/base/types';
import { bumpAuditFields, createAuditFields, ensureEntityId, normalizeLegacyEntity } from '../../../domain/base/audit';
import { NotFoundError, ConflictError } from '../../../common/errors';
import { JsonFileStore } from './JsonFileStore';

export interface JsonRepositoryConfig {
  collection: string;
  arrayKey?: string;
  legacyIdField: string;
  compositeIdFields?: string[];
}

export class JsonRepository<T extends BaseEntity> {
  private readonly arrayKey: string;

  constructor(
    private readonly store: JsonFileStore,
    private readonly config: JsonRepositoryConfig,
  ) {
    this.arrayKey = config.arrayKey ?? 'items';
  }

  private readItems(): T[] {
    return this.store
      .readArray(this.config.collection, this.arrayKey)
      .map((row) => normalizeLegacyEntity<T>(row as Record<string, unknown>, this.config.legacyIdField));
  }

  private writeItems(items: T[]): void {
    this.store.writeArray(this.config.collection, items, this.arrayKey);
    this.store.invalidate(this.config.collection);
  }

  private matchesId(row: T, id: string): boolean {
    if (row.id === id) return true;
    const legacy = row[this.config.legacyIdField as keyof T];
    if (legacy != null && String(legacy) === id) return true;
    if (this.config.compositeIdFields?.length) {
      return buildCompositeId(row as unknown as Record<string, unknown>, this.config.compositeIdFields) === id;
    }
    return false;
  }

  async findAll(): Promise<T[]> {
    return this.readItems();
  }

  async findById(id: string): Promise<T | null> {
    return this.readItems().find((row) => this.matchesId(row, id)) ?? null;
  }

  async create(entity: Partial<T> & Record<string, unknown>): Promise<T> {
    const items = this.readItems();
    const audit = createAuditFields();
    const record = {
      ...entity,
      id: ensureEntityId(entity as Partial<BaseEntity>),
      ...audit,
    } as T;

    if (this.config.compositeIdFields) {
      const compositeId = buildCompositeId(record as unknown as Record<string, unknown>, this.config.compositeIdFields);
      if (items.some((row) => this.matchesId(row, compositeId))) {
        throw new ConflictError('Record with this composite key already exists');
      }
    } else {
      const legacy = record[this.config.legacyIdField as keyof T];
      if (legacy != null && items.some((row) => row[this.config.legacyIdField as keyof T] === legacy)) {
        throw new ConflictError(`${String(this.config.legacyIdField)} already exists: ${String(legacy)}`);
      }
    }

    items.push(record);
    this.writeItems(items);
    return record;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const items = this.readItems();
    const idx = items.findIndex((row) => this.matchesId(row, id));
    if (idx === -1) throw new NotFoundError(this.config.collection, id);

    const merged = bumpAuditFields({ ...items[idx], ...patch, id: items[idx].id } as T);
    items[idx] = merged;
    this.writeItems(items);
    return merged;
  }

  async delete(id: string): Promise<void> {
    const items = this.readItems();
    const idx = items.findIndex((row) => this.matchesId(row, id));
    if (idx === -1) throw new NotFoundError(this.config.collection, id);
    items.splice(idx, 1);
    this.writeItems(items);
  }
}
