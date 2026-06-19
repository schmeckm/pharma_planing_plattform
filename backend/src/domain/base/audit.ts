import { randomUUID } from 'crypto';
import type { AuditFields, BaseEntity } from './types';

const SYSTEM_USER = 'SYSTEM';

export function createAuditFields(userId = SYSTEM_USER): AuditFields {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
    version: 1,
  };
}

export function bumpAuditFields<T extends BaseEntity>(
  entity: T,
  userId = SYSTEM_USER,
): T {
  return {
    ...entity,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
    version: (entity.version ?? 1) + 1,
  };
}

export function ensureEntityId(entity: Partial<BaseEntity>): string {
  return entity.id || randomUUID();
}

export function normalizeLegacyEntity<T extends BaseEntity>(
  row: Record<string, unknown>,
  legacyIdField: string,
): T {
  const now = new Date().toISOString();
  const legacyId = String(row[legacyIdField] ?? '');
  return {
    ...row,
    id: String(row.id ?? (legacyId || randomUUID())),
    createdAt: String(row.createdAt ?? now),
    createdBy: String(row.createdBy ?? SYSTEM_USER),
    updatedAt: String(row.updatedAt ?? now),
    updatedBy: String(row.updatedBy ?? SYSTEM_USER),
    version: Number(row.version ?? 1),
  } as T;
}
