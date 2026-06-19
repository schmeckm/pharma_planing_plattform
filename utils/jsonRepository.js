const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.HAP_DATA_DIR || path.join(__dirname, '..', 'data');

/** Collections loaded at startup when HAP_LIVE_CACHE_WARMUP=true */
const WARMUP_COLLECTIONS = [
  'orders',
  'packagingOrders',
  'salesOrders',
  'batches',
  'rules',
  'rulesV2',
  'roughPlannedOrders',
  'planningOrders',
  'workPlanSnapshots',
  'planChangeEvents',
  'productionLines',
  'lineCalendars',
  'exceptions',
  'inspectionLots',
  'optimizedSchedule',
  'draftSchedules',
  'planningImpactEvents',
  'materialPlanningOwnership',
  'linePerformance',
  'historicalPerformance',
  'planningExceptions',
];

/** Shared in-memory store per data directory — all JsonRepository instances reuse it. */
const _liveStores = new Map();

function liveCacheEnabled() {
  return process.env.HAP_LIVE_CACHE !== 'false';
}

function getLiveStore(dataDir) {
  const key = path.resolve(dataDir);
  if (!_liveStores.has(key)) {
    _liveStores.set(key, { entries: new Map(), hits: 0, misses: 0, warmedAt: null });
  }
  return _liveStores.get(key);
}

function fileMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

class JsonRepository {
  constructor(dataDir = DATA_DIR) {
    this.dataDir = path.resolve(dataDir);
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this._store = getLiveStore(this.dataDir);
  }

  _filePath(collection) {
    return path.join(this.dataDir, `${collection}.json`);
  }

  _readFromDisk(filePath) {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        lastErr = err;
        if (err instanceof SyntaxError && attempt === 0) {
          const start = Date.now();
          while (Date.now() - start < 5) { /* spin briefly */ }
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  read(collection) {
    const filePath = this._filePath(collection);
    if (!fs.existsSync(filePath)) return null;

    if (liveCacheEnabled()) {
      const mtimeMs = fileMtimeMs(filePath);
      const cached = this._store.entries.get(collection);
      if (cached && cached.mtimeMs === mtimeMs) {
        this._store.hits += 1;
        return cached.data;
      }
      this._store.misses += 1;
    }

    const data = this._readFromDisk(filePath);

    if (liveCacheEnabled()) {
      this._store.entries.set(collection, {
        mtimeMs: fileMtimeMs(filePath),
        data,
        loadedAt: Date.now(),
      });
    }

    return data;
  }

  write(collection, data) {
    const filePath = this._filePath(collection);
    const tmpPath = `${filePath}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, payload, 'utf-8');
    this._replaceFileSync(tmpPath, filePath);

    if (liveCacheEnabled()) {
      this._store.entries.set(collection, {
        mtimeMs: fileMtimeMs(filePath),
        data,
        loadedAt: Date.now(),
      });
    }
  }

  /** Windows / OneDrive-safe atomic replace with retries. */
  _replaceFileSync(tmpPath, filePath) {
    const retriable = new Set(['EPERM', 'EBUSY', 'EACCES']);
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { force: true });
        }
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err) {
        if (!retriable.has(err.code) || attempt === 7) {
          try {
            fs.copyFileSync(tmpPath, filePath);
            fs.rmSync(tmpPath, { force: true });
            return;
          } catch {
            throw err;
          }
        }
        const waitUntil = Date.now() + 20 * (attempt + 1);
        while (Date.now() < waitUntil) { /* brief pause for file lock */ }
      }
    }
  }

  readArray(collection, key = 'items') {
    const data = this.read(collection);
    if (!data) return [];
    return Array.isArray(data) ? data : data[key] || [];
  }

  writeArray(collection, items, key = 'items') {
    const existing = this.read(collection);
    if (existing && !Array.isArray(existing) && typeof existing === 'object') {
      this.write(collection, { ...existing, [key]: items });
    } else {
      this.write(collection, { [key]: items });
    }
  }

  appendToArray(collection, item, key = 'items') {
    const items = this.readArray(collection, key);
    items.push(item);
    this.writeArray(collection, items, key);
    return item;
  }

  appendManyToArray(collection, newItems, key = 'items') {
    if (!newItems.length) return [];
    const items = this.readArray(collection, key);
    items.push(...newItems);
    this.writeArray(collection, items, key);
    return newItems;
  }

  updateInArray(collection, idField, idValue, updates, key = 'items') {
    const items = this.readArray(collection, key);
    const index = items.findIndex((item) => item[idField] === idValue);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates };
    this.writeArray(collection, items, key);
    return items[index];
  }

  findInArray(collection, idField, idValue, key = 'items') {
    return this.readArray(collection, key).find((item) => item[idField] === idValue) || null;
  }

  /** Preload hot JSON files into RAM at startup — avoids OneDrive latency on first requests. */
  warmup(collections = WARMUP_COLLECTIONS) {
    const loaded = [];
    const skipped = [];
    for (const name of collections) {
      const filePath = this._filePath(name);
      if (!fs.existsSync(filePath)) {
        skipped.push(name);
        continue;
      }
      this.read(name);
      loaded.push(name);
    }
    this._store.warmedAt = new Date().toISOString();
    return { loaded, skipped, totalEntries: this._store.entries.size };
  }

  invalidate(collection = null) {
    if (collection) {
      this._store.entries.delete(collection);
      return;
    }
    this._store.entries.clear();
    this._store.hits = 0;
    this._store.misses = 0;
  }

  getCacheStats() {
    return {
      enabled: liveCacheEnabled(),
      dataDir: this.dataDir,
      entries: this._store.entries.size,
      hits: this._store.hits,
      misses: this._store.misses,
      warmedAt: this._store.warmedAt,
      collections: [...this._store.entries.keys()],
    };
  }
}

function warmupLiveCache(dataDir = DATA_DIR) {
  if (!liveCacheEnabled()) return { enabled: false };
  if (process.env.HAP_LIVE_CACHE_WARMUP === 'false') return { enabled: true, warmup: 'skipped' };
  return new JsonRepository(dataDir).warmup();
}

module.exports = {
  JsonRepository,
  DATA_DIR,
  WARMUP_COLLECTIONS,
  warmupLiveCache,
};
