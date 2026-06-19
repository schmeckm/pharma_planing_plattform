import fs from 'fs';
import path from 'path';
import { PersistenceError } from '../../../common/errors';

export class JsonFileStore {
  private readonly dataDir: string;
  private readonly cache = new Map<string, { mtimeMs: number; data: unknown }>();

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getDataDir(): string {
    return this.dataDir;
  }

  private filePath(collection: string): string {
    return path.join(this.dataDir, `${collection}.json`);
  }

  private fileMtimeMs(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }

  read(collection: string): unknown | null {
    const filePath = this.filePath(collection);
    if (!fs.existsSync(filePath)) return null;

    const mtimeMs = this.fileMtimeMs(filePath);
    const cached = this.cache.get(collection);
    if (cached && cached.mtimeMs === mtimeMs) {
      return cached.data;
    }

    const data = this.readFromDisk(filePath);
    this.cache.set(collection, { mtimeMs: this.fileMtimeMs(filePath), data });
    return data;
  }

  private readFromDisk(filePath: string): unknown {
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as unknown;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (lastErr instanceof SyntaxError && attempt === 0) {
          const waitUntil = Date.now() + 5;
          while (Date.now() < waitUntil) { /* brief pause */ }
          continue;
        }
        throw new PersistenceError(`Failed to read ${filePath}: ${lastErr.message}`);
      }
    }
    throw lastErr ?? new PersistenceError(`Failed to read ${filePath}`);
  }

  write(collection: string, data: unknown): void {
    const filePath = this.filePath(collection);
    const tmpPath = `${filePath}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    try {
      fs.writeFileSync(tmpPath, payload, 'utf-8');
      this.replaceFileSync(tmpPath, filePath);
      this.cache.set(collection, {
        mtimeMs: this.fileMtimeMs(filePath),
        data,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new PersistenceError(`Failed to write ${collection}: ${message}`);
    }
  }

  private replaceFileSync(tmpPath: string, filePath: string): void {
    const retriable = new Set(['EPERM', 'EBUSY', 'EACCES']);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { force: true });
        }
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (!code || !retriable.has(code) || attempt === 7) {
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

  readArray(collection: string, arrayKey = 'items'): unknown[] {
    const data = this.read(collection);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>;
      const items = record[arrayKey];
      return Array.isArray(items) ? items : [];
    }
    return [];
  }

  writeArray(collection: string, items: unknown[], arrayKey = 'items'): void {
    const existing = this.read(collection);
    if (existing && !Array.isArray(existing) && typeof existing === 'object') {
      this.write(collection, { ...(existing as Record<string, unknown>), [arrayKey]: items });
    } else {
      this.write(collection, { [arrayKey]: items });
    }
  }

  invalidate(collection?: string): void {
    if (collection) {
      this.cache.delete(collection);
      return;
    }
    this.cache.clear();
  }
}
