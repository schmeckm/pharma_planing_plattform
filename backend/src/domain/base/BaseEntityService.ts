import type { BaseEntity, ListQuery, PaginatedResult, Repository } from '../../domain/base/types';
import { buildCompositeId } from '../../domain/base/types';
import { NotFoundError, ValidationError, ConflictError } from '../../common/errors';
import { validateEntity, type EntitySlug } from '../../common/validation/schemas';
import type { EntityRegistryEntry } from './types';
import { randomUUID } from 'crypto';

export class BaseEntityService<T extends BaseEntity> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityMeta: EntityRegistryEntry,
    protected readonly slug: EntitySlug,
  ) {}

  protected enrichRow(row: T): T & { _compositeId?: string } {
    if (this.entityMeta.compositeIdFields) {
      return {
        ...row,
        _compositeId: buildCompositeId(row as unknown as Record<string, unknown>, this.entityMeta.compositeIdFields),
      };
    }
    return row;
  }

  protected resolvePublicId(row: T): string {
    if (this.entityMeta.compositeIdFields) {
      return buildCompositeId(row as unknown as Record<string, unknown>, this.entityMeta.compositeIdFields);
    }
    const legacy = row[this.entityMeta.idField as keyof T];
    return String(row.id ?? legacy ?? '');
  }

  async findAll(): Promise<T[]> {
    const items = await this.repository.findAll();
    return items.map((row) => this.enrichRow(row));
  }

  async findById(id: string): Promise<T> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundError(this.entityMeta.label, id);
    return this.enrichRow(row);
  }

  async list(query: ListQuery = {}): Promise<PaginatedResult<T> & { slug: string; label: string; idField: string }> {
    let items = await this.findAll();

    const q = String(query.search ?? '').trim().toLowerCase();
    if (q) {
      items = items.filter((row) =>
        (this.entityMeta.searchFields || []).some((f) =>
          String((row as Record<string, unknown>)[f] ?? '').toLowerCase().includes(q),
        ),
      );
    }

    for (const [key, value] of Object.entries(query.filters ?? {})) {
      if (value == null || value === '') continue;
      items = items.filter((row) => String((row as Record<string, unknown>)[key] ?? '') === String(value));
    }

    if (query.sortField) {
      const dir = (query.sortOrder ?? 1) >= 0 ? 1 : -1;
      const field = query.sortField;
      items.sort((a, b) => {
        const va = (a as Record<string, unknown>)[field];
        const vb = (b as Record<string, unknown>)[field];
        if (va == null && vb == null) return 0;
        if (va == null) return dir;
        if (vb == null) return -dir;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
      });
    }

    const total = items.length;
    const safePage = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const safeSize = Math.min(200, Math.max(1, parseInt(String(query.pageSize ?? 25), 10) || 25));
    const start = (safePage - 1) * safeSize;

    return {
      slug: this.slug,
      label: this.entityMeta.label,
      idField: this.entityMeta.compositeIdFields ? '_compositeId' : this.entityMeta.idField,
      items: items.slice(start, start + safeSize),
      pagination: {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages: Math.ceil(total / safeSize) || 1,
      },
    };
  }

  async create(body: unknown): Promise<T> {
    const validation = validateEntity(this.slug, body);
    if (!validation.success) {
      throw new ValidationError(
        validation.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
        validation.errors.map((e) => `${e.path}: ${e.message}`),
      );
    }

    const record = { ...validation.data } as Record<string, unknown>;
    if (!this.entityMeta.compositeIdFields && !record[this.entityMeta.idField]) {
      const prefix = this.entityMeta.idField.replace(/Id$/i, '').toUpperCase() || 'ID';
      record[this.entityMeta.idField] = `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
    }

    const existing = await this.repository.findAll();
    if (this.entityMeta.compositeIdFields) {
      const compositeId = buildCompositeId(record, this.entityMeta.compositeIdFields);
      if (existing.some((row) => this.resolvePublicId(row) === compositeId)) {
        throw new ConflictError('Record with this composite key already exists');
      }
    } else {
      const legacyKey = record[this.entityMeta.idField];
      if (existing.some((row) => row[this.entityMeta.idField as keyof T] === legacyKey)) {
        throw new ConflictError(`${this.entityMeta.idField} already exists: ${String(legacyKey)}`);
      }
    }

    const created = await this.repository.create(record as Omit<T, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'version' | 'id'> & Partial<T>);
    return this.enrichRow(created);
  }

  async update(id: string, body: unknown): Promise<T> {
    const validation = validateEntity(this.slug, body, { partial: true });
    if (!validation.success) {
      throw new ValidationError(
        validation.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
        validation.errors.map((e) => `${e.path}: ${e.message}`),
      );
    }

    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError(this.entityMeta.label, id);

    const merged = { ...existing, ...validation.data } as T;
    if (this.entityMeta.compositeIdFields) {
      const fullValidation = validateEntity(this.slug, merged);
      if (!fullValidation.success) {
        throw new ValidationError(
          fullValidation.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
          fullValidation.errors.map((e) => `${e.path}: ${e.message}`),
        );
      }
    }

    const updated = await this.repository.update(id, validation.data as Partial<T>);
    return this.enrichRow(updated);
  }

  async delete(id: string): Promise<{ deleted: true; id: string; record: T }> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError(this.entityMeta.label, id);
    await this.repository.delete(id);
    return { deleted: true, id, record: this.enrichRow(existing) };
  }
}

/** Thin domain service — extend for entity-specific business rules. */
export class PlanningOrderService extends BaseEntityService<import('../../domain/entities').PlanningOrder> {}
export class OperationService extends BaseEntityService<import('../../domain/entities').Operation> {}
export class ComponentService extends BaseEntityService<import('../../domain/entities').Component> {}
export class MaterialService extends BaseEntityService<import('../../domain/entities').Material> {}
export class BatchService extends BaseEntityService<import('../../domain/entities').Batch> {}
export class TricCaseService extends BaseEntityService<import('../../domain/entities').TricCase> {}
export class InspectionLotService extends BaseEntityService<import('../../domain/entities').InspectionLot> {}
export class ResourceService extends BaseEntityService<import('../../domain/entities').Resource> {}
export class SetupMatrixService extends BaseEntityService<import('../../domain/entities').SetupMatrixEntry> {}
export class CapacityBucketService extends BaseEntityService<import('../../domain/entities').CapacityBucket> {}
export class PlanningHorizonService extends BaseEntityService<import('../../domain/entities').PlanningHorizon> {}
export class WorkCenterService extends BaseEntityService<import('../../domain/entities').WorkCenter> {}
export class PackagingLineService extends BaseEntityService<import('../../domain/entities').PackagingLine> {}
export class ShiftCalendarService extends BaseEntityService<import('../../domain/entities').ShiftCalendar> {}
export class ExceptionService extends BaseEntityService<import('../../domain/entities').PlanningException> {}
export class PlanningResultService extends BaseEntityService<import('../../domain/entities').PlanningResult> {}

export type EntityService =
  | PlanningOrderService
  | OperationService
  | ComponentService
  | MaterialService
  | BatchService
  | TricCaseService
  | InspectionLotService
  | ResourceService
  | SetupMatrixService
  | CapacityBucketService
  | PlanningHorizonService
  | WorkCenterService
  | PackagingLineService
  | ShiftCalendarService
  | ExceptionService
  | PlanningResultService;

export type ServiceMap = Record<EntitySlug, EntityService>;
