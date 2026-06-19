/**
 * @deprecated Use backend/dist bridge (layered TypeScript architecture).
 * Kept as fallback when backend is not compiled.
 */
const { JsonRepository } = require('../utils/jsonRepository');
const { generateId } = require('../utils/idGenerator');
const { NotFoundError, ValidationError } = require('../utils/errors');
const {
  getEntity,
  listEntities,
  buildCompositeId,
  parseCompositeId,
} = require('../config/adminDataEntities');
const { validateEntity } = require('../validation/adminDataSchemas');

class AdminDataService {
  constructor(repository = new JsonRepository()) {
    this.repo = repository;
  }

  listEntitySlugs() {
    return listEntities().map((e) => ({
      slug: e.slug,
      label: e.label,
      idField: e.idField,
    }));
  }

  _enrichRow(entity, row) {
    if (entity.compositeIdFields) {
      return {
        ...row,
        _compositeId: buildCompositeId(row, entity.compositeIdFields),
      };
    }
    return row;
  }

  _matchId(entity, row, id) {
    if (entity.compositeIdFields) {
      return buildCompositeId(row, entity.compositeIdFields) === id;
    }
    return row[entity.idField] === id;
  }

  _findIndex(items, entity, id) {
    return items.findIndex((row) => this._matchId(entity, row, id));
  }

  list(slug, {
    search = '',
    page = 1,
    pageSize = 25,
    sortField = null,
    sortOrder = 1,
    filters = {},
  } = {}) {
    const entity = getEntity(slug);
    if (!entity) throw new NotFoundError('Entity', slug);

    let items = this.repo.readArray(entity.collection, entity.arrayKey).map((row) => this._enrichRow(entity, row));

    const q = String(search).trim().toLowerCase();
    if (q) {
      items = items.filter((row) =>
        (entity.searchFields || []).some((f) =>
          String(row[f] ?? '').toLowerCase().includes(q),
        ),
      );
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value == null || value === '') continue;
      items = items.filter((row) => String(row[key] ?? '') === String(value));
    }

    if (sortField) {
      const dir = sortOrder >= 0 ? 1 : -1;
      items.sort((a, b) => {
        const va = a[sortField];
        const vb = b[sortField];
        if (va == null && vb == null) return 0;
        if (va == null) return dir;
        if (vb == null) return -dir;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
      });
    }

    const total = items.length;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 25));
    const start = (safePage - 1) * safeSize;
    const paged = items.slice(start, start + safeSize);

    return {
      slug,
      label: entity.label,
      idField: entity.compositeIdFields ? '_compositeId' : entity.idField,
      items: paged,
      pagination: {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages: Math.ceil(total / safeSize) || 1,
      },
    };
  }

  getById(slug, id) {
    const entity = getEntity(slug);
    if (!entity) throw new NotFoundError('Entity', slug);

    const items = this.repo.readArray(entity.collection, entity.arrayKey);
    const row = items.find((r) => this._matchId(entity, r, id));
    if (!row) throw new NotFoundError(entity.label, id);
    return this._enrichRow(entity, row);
  }

  create(slug, body) {
    const entity = getEntity(slug);
    if (!entity) throw new NotFoundError('Entity', slug);

    const validation = validateEntity(slug, body);
    if (!validation.success) {
      throw new ValidationError(validation.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
    }

    const record = { ...validation.data };
    if (!entity.compositeIdFields && !record[entity.idField]) {
      record[entity.idField] = generateId(entity.idField.replace(/Id$/i, '').toUpperCase() || 'ID');
    }

    const items = this.repo.readArray(entity.collection, entity.arrayKey);
    if (entity.compositeIdFields) {
      const exists = items.some((r) => this._matchId(entity, r, buildCompositeId(record, entity.compositeIdFields)));
      if (exists) {
        throw new ValidationError('Record with this composite key already exists');
      }
    } else if (items.some((r) => r[entity.idField] === record[entity.idField])) {
      throw new ValidationError(`${entity.idField} already exists: ${record[entity.idField]}`);
    }

    items.push(record);
    this.repo.writeArray(entity.collection, items, entity.arrayKey);
    this.repo.invalidate(entity.collection);
    return this._enrichRow(entity, record);
  }

  update(slug, id, body) {
    const entity = getEntity(slug);
    if (!entity) throw new NotFoundError('Entity', slug);

    const validation = validateEntity(slug, body, { partial: true });
    if (!validation.success) {
      throw new ValidationError(validation.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
    }

    const items = this.repo.readArray(entity.collection, entity.arrayKey);
    const idx = this._findIndex(items, entity, id);
    if (idx === -1) throw new NotFoundError(entity.label, id);

    const merged = { ...items[idx], ...validation.data };
    if (entity.compositeIdFields) {
      const fullValidation = validateEntity(slug, merged);
      if (!fullValidation.success) {
        throw new ValidationError(fullValidation.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
      }
    }

    items[idx] = merged;
    this.repo.writeArray(entity.collection, items, entity.arrayKey);
    this.repo.invalidate(entity.collection);
    return this._enrichRow(entity, merged);
  }

  delete(slug, id) {
    const entity = getEntity(slug);
    if (!entity) throw new NotFoundError('Entity', slug);

    const items = this.repo.readArray(entity.collection, entity.arrayKey);
    const idx = this._findIndex(items, entity, id);
    if (idx === -1) throw new NotFoundError(entity.label, id);

    const [removed] = items.splice(idx, 1);
    this.repo.writeArray(entity.collection, items, entity.arrayKey);
    this.repo.invalidate(entity.collection);
    return { deleted: true, id, record: this._enrichRow(entity, removed) };
  }
}

module.exports = { AdminDataService };
