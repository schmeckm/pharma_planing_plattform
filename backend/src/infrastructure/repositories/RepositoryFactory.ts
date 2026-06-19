import { config } from '../../config/env';
import { JsonFileStore } from '../persistence/json/JsonFileStore';
import { JsonRepository } from '../persistence/json/JsonRepository';
import { PostgresRepository } from '../persistence/postgres/repositories/PostgresRepository';
import { ENTITY_REGISTRY } from '../../config/entityRegistry';
import type { BaseEntity, Repository } from '../../domain/base/types';
import type { PlanningOrder, PlanningHorizon, Batch, Operation } from '../../domain/entities';
import {
  BaseEntityService,
  PlanningOrderService,
  OperationService,
  ComponentService,
  MaterialService,
  BatchService,
  TricCaseService,
  InspectionLotService,
  ResourceService,
  SetupMatrixService,
  CapacityBucketService,
  PlanningHorizonService,
  WorkCenterService,
  PackagingLineService,
  ShiftCalendarService,
  ExceptionService,
  PlanningResultService,
} from '../../domain/base/BaseEntityService';
import type { EntitySlug } from '../../common/validation/schemas';

let fileStore: JsonFileStore | null = null;

function getFileStore(): JsonFileStore {
  if (!fileStore) {
    fileStore = new JsonFileStore(config.dataDir);
  }
  return fileStore;
}

function createJsonRepo<T extends BaseEntity>(slug: EntitySlug): JsonRepository<T> {
  const meta = ENTITY_REGISTRY[slug];
  const legacyIdField = meta.compositeIdFields?.[0] ?? meta.idField;
  return new JsonRepository<T>(getFileStore(), {
    collection: meta.collection,
    arrayKey: meta.arrayKey,
    legacyIdField,
    compositeIdFields: meta.compositeIdFields,
  });
}

function createRepo<T extends BaseEntity>(slug: EntitySlug): Repository<T> {
  if (config.persistenceProvider === 'postgres') {
    return new (class extends PostgresRepository<T> {
      constructor() {
        super(ENTITY_REGISTRY[slug].collection);
      }
    })();
  }
  return createJsonRepo<T>(slug);
}

let serviceMap: Record<EntitySlug, BaseEntityService<BaseEntity>> | null = null;

export function getServiceMap(): Record<EntitySlug, BaseEntityService<BaseEntity>> {
  if (!serviceMap) {
    const factories: Record<EntitySlug, () => BaseEntityService<BaseEntity>> = {
      'planning-orders': () => new PlanningOrderService(createRepo('planning-orders'), ENTITY_REGISTRY['planning-orders'], 'planning-orders') as BaseEntityService<BaseEntity>,
      operations: () => new OperationService(createRepo('operations'), ENTITY_REGISTRY.operations, 'operations') as BaseEntityService<BaseEntity>,
      components: () => new ComponentService(createRepo('components'), ENTITY_REGISTRY.components, 'components') as BaseEntityService<BaseEntity>,
      materials: () => new MaterialService(createRepo('materials'), ENTITY_REGISTRY.materials, 'materials') as BaseEntityService<BaseEntity>,
      batches: () => new BatchService(createRepo('batches'), ENTITY_REGISTRY.batches, 'batches') as BaseEntityService<BaseEntity>,
      'tric-cases': () => new TricCaseService(createRepo('tric-cases'), ENTITY_REGISTRY['tric-cases'], 'tric-cases') as BaseEntityService<BaseEntity>,
      'inspection-lots': () => new InspectionLotService(createRepo('inspection-lots'), ENTITY_REGISTRY['inspection-lots'], 'inspection-lots') as BaseEntityService<BaseEntity>,
      resources: () => new ResourceService(createRepo('resources'), ENTITY_REGISTRY.resources, 'resources') as BaseEntityService<BaseEntity>,
      'setup-matrix': () => new SetupMatrixService(createRepo('setup-matrix'), ENTITY_REGISTRY['setup-matrix'], 'setup-matrix') as BaseEntityService<BaseEntity>,
      'capacity-buckets': () => new CapacityBucketService(createRepo('capacity-buckets'), ENTITY_REGISTRY['capacity-buckets'], 'capacity-buckets') as BaseEntityService<BaseEntity>,
      'planning-horizons': () => new PlanningHorizonService(createRepo('planning-horizons'), ENTITY_REGISTRY['planning-horizons'], 'planning-horizons') as BaseEntityService<BaseEntity>,
      'work-centers': () => new WorkCenterService(createRepo('work-centers'), ENTITY_REGISTRY['work-centers'], 'work-centers') as BaseEntityService<BaseEntity>,
      'packaging-lines': () => new PackagingLineService(createRepo('packaging-lines'), ENTITY_REGISTRY['packaging-lines'], 'packaging-lines') as BaseEntityService<BaseEntity>,
      'shift-calendars': () => new ShiftCalendarService(createRepo('shift-calendars'), ENTITY_REGISTRY['shift-calendars'], 'shift-calendars') as BaseEntityService<BaseEntity>,
      exceptions: () => new ExceptionService(createRepo('exceptions'), ENTITY_REGISTRY.exceptions, 'exceptions') as BaseEntityService<BaseEntity>,
      'planning-results': () => new PlanningResultService(createRepo('planning-results'), ENTITY_REGISTRY['planning-results'], 'planning-results') as BaseEntityService<BaseEntity>,
    };
    serviceMap = Object.fromEntries(
      (Object.keys(factories) as EntitySlug[]).map((slug) => [slug, factories[slug]()]),
    ) as Record<EntitySlug, BaseEntityService<BaseEntity>>;
  }
  return serviceMap;
}

export function getPlanningOrderRepository(): Repository<PlanningOrder> {
  return createRepo<PlanningOrder>('planning-orders');
}

export function getOperationRepository(): Repository<Operation> {
  return createRepo<Operation>('operations');
}

export function getPlanningHorizonRepository(): Repository<PlanningHorizon> {
  return createRepo<PlanningHorizon>('planning-horizons');
}

export function getBatchRepository(): Repository<Batch> {
  return createRepo<Batch>('batches');
}

export function resetRepositoryFactory(): void {
  fileStore = null;
  serviceMap = null;
}
