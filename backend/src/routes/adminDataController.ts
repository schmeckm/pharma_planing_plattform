import type { Request, Response, NextFunction } from 'express';
import { listEntities } from '../config/entityRegistry';
import { getServiceMap } from '../infrastructure/repositories/RepositoryFactory';
import type { EntitySlug } from '../common/validation/schemas';
import type { BaseEntityService } from '../domain/base/BaseEntityService';
import type { BaseEntity } from '../domain/base/types';
import { createCrudController } from './crudRouteFactory';

export function listEntitiesMeta(_req: Request, res: Response): void {
  res.json({
    entities: listEntities().map((e) => ({
      slug: e.slug,
      label: e.label,
      idField: e.compositeIdFields ? '_compositeId' : e.idField,
    })),
    persistenceProvider: process.env.PERSISTENCE_PROVIDER || 'json',
  });
}

function getService(slug: string): BaseEntityService<BaseEntity> {
  const services = getServiceMap();
  const service = services[slug as EntitySlug];
  if (!service) throw new Error(`Unknown entity slug: ${slug}`);
  return service;
}

function slugParam(req: Request): string {
  const slug = req.params.slug;
  return Array.isArray(slug) ? slug[0] : String(slug);
}

export function listRecords(req: Request, res: Response, next: NextFunction): void {
  req.params.slug = slugParam(req);
  createCrudController(getService(slugParam(req))).list(req, res, next);
}

export function getRecord(req: Request, res: Response, next: NextFunction): void {
  req.params.slug = slugParam(req);
  createCrudController(getService(slugParam(req))).getById(req, res, next);
}

export function createRecord(req: Request, res: Response, next: NextFunction): void {
  req.params.slug = slugParam(req);
  createCrudController(getService(slugParam(req))).create(req, res, next);
}

export function updateRecord(req: Request, res: Response, next: NextFunction): void {
  req.params.slug = slugParam(req);
  createCrudController(getService(slugParam(req))).update(req, res, next);
}

export function deleteRecord(req: Request, res: Response, next: NextFunction): void {
  req.params.slug = slugParam(req);
  createCrudController(getService(slugParam(req))).remove(req, res, next);
}
