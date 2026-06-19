import type { Request, Response, NextFunction, Router } from 'express';
import type { BaseEntityService } from '../domain/base/BaseEntityService';
import type { BaseEntity, ListQuery } from '../domain/base/types';

function parseListQuery(req: Request): ListQuery {
  let filters: Record<string, string> = {};
  if (req.query.filters && typeof req.query.filters === 'string') {
    try {
      filters = JSON.parse(req.query.filters) as Record<string, string>;
    } catch {
      filters = {};
    }
  }
  return {
    search: String(req.query.search ?? ''),
    page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
    pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 25,
    sortField: req.query.sortField ? String(req.query.sortField) : null,
    sortOrder: req.query.sortOrder === 'desc' ? -1 : 1,
    filters,
  };
}

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : String(id);
}

export function createCrudController(service: BaseEntityService<BaseEntity>) {
  return {
    list: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        res.json(await service.list(parseListQuery(req)));
      } catch (err) {
        next(err);
      }
    },
    getById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        res.json(await service.findById(paramId(req)));
      } catch (err) {
        next(err);
      }
    },
    create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        res.status(201).json(await service.create(req.body ?? {}));
      } catch (err) {
        next(err);
      }
    },
    update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        res.json(await service.update(paramId(req), req.body ?? {}));
      } catch (err) {
        next(err);
      }
    },
    remove: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        res.json(await service.delete(paramId(req)));
      } catch (err) {
        next(err);
      }
    },
  };
}

export function createCrudRoutes(router: Router, basePath: string, service: BaseEntityService<BaseEntity>): void {
  const ctrl = createCrudController(service);
  router.get(basePath, ctrl.list);
  router.get(`${basePath}/:id`, ctrl.getById);
  router.post(basePath, ctrl.create);
  router.put(`${basePath}/:id`, ctrl.update);
  router.delete(`${basePath}/:id`, ctrl.remove);
}
