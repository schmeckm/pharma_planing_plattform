const { AdminDataService } = require('../services/adminDataService');
const { listEntities } = require('../config/adminDataEntities');

const svc = new AdminDataService();

function parseListQuery(req) {
  return {
    search: req.query.search || '',
    page: req.query.page,
    pageSize: req.query.pageSize,
    sortField: req.query.sortField || null,
    sortOrder: req.query.sortOrder === 'desc' ? -1 : 1,
    filters: req.query.filters ? JSON.parse(req.query.filters) : {},
  };
}

async function listEntitiesMeta(_req, res, next) {
  try {
    res.json({ entities: svc.listEntitySlugs() });
  } catch (err) {
    next(err);
  }
}

async function listRecords(req, res, next) {
  try {
    res.json(svc.list(req.params.slug, parseListQuery(req)));
  } catch (err) {
    next(err);
  }
}

async function getRecord(req, res, next) {
  try {
    res.json(svc.getById(req.params.slug, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function createRecord(req, res, next) {
  try {
    res.status(201).json(svc.create(req.params.slug, req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function updateRecord(req, res, next) {
  try {
    res.json(svc.update(req.params.slug, req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function deleteRecord(req, res, next) {
  try {
    res.json(svc.delete(req.params.slug, req.params.id));
  } catch (err) {
    next(err);
  }
}

function registerEntityRoutes(router) {
  for (const entity of listEntities()) {
    const base = `/${entity.slug}`;
    router.get(base, (req, res, next) => {
      req.params.slug = entity.slug;
      listRecords(req, res, next);
    });
    router.get(`${base}/:id`, (req, res, next) => {
      req.params.slug = entity.slug;
      getRecord(req, res, next);
    });
    router.post(base, (req, res, next) => {
      req.params.slug = entity.slug;
      createRecord(req, res, next);
    });
    router.put(`${base}/:id`, (req, res, next) => {
      req.params.slug = entity.slug;
      updateRecord(req, res, next);
    });
    router.delete(`${base}/:id`, (req, res, next) => {
      req.params.slug = entity.slug;
      deleteRecord(req, res, next);
    });
  }
}

module.exports = {
  listEntitiesMeta,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  registerEntityRoutes,
};
