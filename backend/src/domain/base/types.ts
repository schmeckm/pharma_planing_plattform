/** Audit fields for all canonical entities. */
export interface AuditFields {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

/** Source system metadata for SAP / MES integration. */
export interface SourceSystemFields {
  sourceSystem?: string;
  sourceObjectType?: string;
  sourceObjectId?: string;
  sourcePayload?: Record<string, unknown>;
  lastImportedAt?: string;
}

/** Base entity — internal UUID is the technical primary key. */
export interface BaseEntity extends AuditFields, SourceSystemFields {
  id: string;
}

export interface Repository<T extends BaseEntity> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(entity: Partial<T> & Record<string, unknown>): Promise<T>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface ListQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  sortField?: string | null;
  sortOrder?: 1 | -1;
  filters?: Record<string, string | number | boolean | null | undefined>;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface EntityRegistryEntry {
  slug: string;
  label: string;
  collection: string;
  arrayKey: string;
  idField: string;
  searchFields: string[];
  compositeIdFields?: string[];
}

export function buildCompositeId(row: Record<string, unknown>, fields: string[]): string {
  return fields.map((f) => String(row[f] ?? '')).join('__');
}

export function parseCompositeId(id: string, fields: string[]): Record<string, string> {
  const parts = String(id).split('__');
  const result: Record<string, string> = {};
  fields.forEach((f, i) => {
    result[f] = parts[i] ?? '';
  });
  return result;
}
