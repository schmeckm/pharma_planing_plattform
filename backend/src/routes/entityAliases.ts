import { Router } from 'express';
import { listEntities } from '../config/entityRegistry';
import { getServiceMap } from '../infrastructure/repositories/RepositoryFactory';
import { createCrudRoutes } from './crudRouteFactory';
import type { EntitySlug } from '../common/validation/schemas';
import type { BaseEntity } from '../domain/base/types';
import type { BaseEntityService } from '../domain/base/BaseEntityService';

/** REST aliases at /api/v1/{slug} — backward compatible with admin CRUD UI. */
export function registerEntityAliasRoutes(router: Router): void {
  const services = getServiceMap();
  for (const entity of listEntities()) {
    const slug = entity.slug as EntitySlug;
    createCrudRoutes(router, `/${entity.slug}`, services[slug] as BaseEntityService<BaseEntity>);
  }
}
